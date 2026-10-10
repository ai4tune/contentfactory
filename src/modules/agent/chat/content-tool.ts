import { createHash } from "node:crypto";
import { getFirstContentAccount } from "@/modules/onboarding/first-content/service";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { formatKnowledgeProfileForPrompt } from "@/modules/knowledge-profile/service";
import { getActiveStyleContract } from "@/modules/style-profile/service";
import { createContentBrief } from "@/modules/content/server/brief-service";
import { getContentProject, replaceChannelDraft, saveContentProject } from "@/modules/content/server/project-repository";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { reviewChannelDraft } from "@/modules/reviews/service";
import { saveChannelReview } from "@/modules/reviews/server/repository";
import type { BriefKnowledgeSource, ContentChannel } from "@/modules/content/types";
import { assertTurnActive, updateTurn } from "./repository";
import { ChatError } from "./types";

export async function createChatDraft(input: {
  topic: string; channel: ContentChannel; instructions: string; sourceIds: string[];
}, turnId: string, attempt: number, availableSources: BriefKnowledgeSource[], memories: string[]) {
  const checkpoint = async (stage: string) => {
    await assertTurnActive(turnId, attempt);
    await updateTurn(turnId, attempt, (turn) => {
      if (turn.status !== "running" && turn.status !== "queued") throw new ChatError("任务已暂停，已完成结果保留。", 409);
      return { ...turn, stage };
    });
  };
  const id = `agent_${createHash("sha256").update(turnId).digest("hex").slice(0, 24)}`;
  let project = await getContentProject(id);
  if (project && (project.topic !== input.topic || (project.channels.length && !project.channels.includes(input.channel)))) {
    throw new ChatError("本次任务已经开始创作另一篇，请发送新的诉求。", 409);
  }
  const [currentAccount, knowledge] = await Promise.all([getFirstContentAccount(), getConfirmedKnowledgeProfile()]);
  const account = project?.accountSnapshot ?? currentAccount;
  if (!account) return { needsInput: true, question: "请先确认店铺或业务信息，再让我写这篇。", href: "/setup/first-content" };
  if (input.sourceIds.some((id) => !availableSources.some((source) => source.id === id))) throw new ChatError("所选资料不属于当前账号或本次对话。", 404);
  const turn = await assertTurnActive(turnId, attempt);
  const previousSources = turn.tools.find((item) => item.key === "create_draft")?.draftSources;
  const sources: BriefKnowledgeSource[] = previousSources ?? [
    { id: `confirmed-account:${account.updatedAt}`, title: "用户已确认的经营信息", source: "upload",
      text: JSON.stringify({ name: account.accountName, business: account.business, offer: account.offer, goal: account.conversionGoal, answers: account.answeredQuestions ?? [] }) },
    ...(knowledge ? [{ id: `confirmed-knowledge:v${knowledge.version}`, title: "已确认企业知识档案", source: "upload" as const, text: formatKnowledgeProfileForPrompt(knowledge) }] : []),
    ...availableSources.filter((source) => input.sourceIds.includes(source.id)),
  ];
  if (!previousSources) await updateTurn(turnId, attempt, (item) => {
    if (item.status !== "running" && item.status !== "queued") throw new ChatError("任务已暂停，资料快照尚未保存。", 409);
    return { ...item, tools: item.tools.map((tool) => tool.key === "create_draft" ? { ...tool, draftSources: sources } : tool) };
  });
  if (!project) {
    await checkpoint("正在核对资料并整理写作简报");
    const temporaryStyleInstructions = [...memories.map((item) => `用户记忆（表达偏好，不能提供事实）：${item}`), input.instructions].filter(Boolean);
    const style = await getActiveStyleContract({ temporaryInstructions: temporaryStyleInstructions });
    const brief = await createContentBrief(input.topic, account, sources, null, style, null, null, knowledge);
    await checkpoint("简报已整理，正在保存");
    project = await saveContentProject({ id, topic: input.topic, brief, accountSnapshot: account, styleSnapshot: style,
      temporaryStyleInstructions, knowledgeProfileVersion: knowledge?.version, channels: [input.channel] });
  }
  let draft = project.channelDrafts.find((item) => item.channel === input.channel && item.status === "generated");
  if (!draft) {
    await checkpoint("正在写作并核对正文事实");
    draft = await generateChannelDraft({ topic: project.topic, channel: input.channel, brief: project.brief, sources,
      accountContext: project.accountSnapshot, styleContract: project.styleSnapshot, temporaryStyleInstructions: project.temporaryStyleInstructions });
    await checkpoint("正文已生成，正在保存草稿");
    project = (await replaceChannelDraft(id, draft, true))!;
    draft = project.channelDrafts.find((item) => item.channel === input.channel)!;
  }
  if (!draft.review || draft.review.reviewedContent !== draft.content || draft.review.reviewedTitle !== draft.delivery?.title) {
    await checkpoint("草稿已保存，正在审核");
    const review = await reviewChannelDraft({ project, draft });
    await checkpoint("正在保存审核结果");
    project = await saveChannelReview(id, input.channel, review);
  }
  const saved = project.channelDrafts.find((item) => item.channel === input.channel)!;
  return { projectId: id, title: saved.delivery?.title || project.topic, channel: input.channel,
    href: `/drafts/${id}`, reviewed: Boolean(saved.review), published: false, sources: project.selectedKnowledgeRefs,
    review: saved.review ? { riskLevel: saved.review.riskLevel, conclusion: saved.review.conclusion,
      issues: saved.review.issues.map(({ category, title, requiresConfirmation }) => ({ category, title, requiresConfirmation })) } : null,
    preview: saved.content.slice(0, 1200), photoSuggestions: saved.photoPlan?.suggestions ?? [] };
}
