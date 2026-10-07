import { createHash } from "node:crypto";
import { getIdeaFromDb, saveIdeaToDb } from "@/lib/db";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { createContentBrief } from "@/modules/content/server/brief-service";
import { getContentProject, replaceChannelDraft, saveContentProject } from "@/modules/content/server/project-repository";
import { channelLabels, type BriefKnowledgeSource, type ContentChannel } from "@/modules/content/types";
import { getIdeaContext } from "@/modules/ideas/service";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { formatKnowledgeProfileForPrompt } from "@/modules/knowledge-profile/service";
import { getActiveAccountContext } from "@/modules/positioning/service";
import type { AccountContext } from "@/modules/positioning/types";
import { saveChannelReview } from "@/modules/reviews/server/repository";
import { reviewChannelDraft } from "@/modules/reviews/service";
import { getCurrentStyleProfile, getConfirmedStyleProfile, saveCurrentStyleProfile } from "@/modules/style-profile/repository";
import { validateStyleProfileForConfirmation } from "@/modules/style-profile/request";
import { compileStyleContract } from "@/modules/style-profile/compiler";
import { getInterviewState } from "../interview-repository";
import { InterviewError } from "../interview";
import { getStoredOnboardingStatus } from "../repository";
import { buildStarterStyle, isIndustry, isVoice, starterTopics, voices, type IndustryId } from "./catalog";

async function requiredAccount() {
  const account = await getActiveAccountContext();
  if (!account) throw new InterviewError("请先确认经营信息，再选择口吻和第一篇选题。", 409);
  return account;
}

function ideaId(account: AccountContext, topicId: string) {
  return `starter_${createHash("sha256").update(`${account.updatedAt}:${account.accountName}:${topicId}`).digest("hex").slice(0, 24)}`;
}

export async function getFirstContentSnapshot(selectedIndustry?: IndustryId) {
  const account = await requiredAccount();
  const [currentProfile, confirmedProfile, interview, onboarding] = await Promise.all([
    getCurrentStyleProfile(), getConfirmedStyleProfile(), getInterviewState(), getStoredOnboardingStatus(),
  ]);
  const industry = selectedIndustry ?? currentProfile?.starterTemplate?.industry ?? interview.answers.industry ?? "general";
  const topics = await Promise.all(starterTopics(account).map(async (topic) => {
    const project = await getContentProject(`first_${ideaId(account, topic.id)}`);
    return { ...topic, audience: account.targetAudience.join("、"), projectId: project?.channelDrafts.some((draft) => draft.status === "generated") ? project.id : undefined };
  }));
  return {
    accountName: account.accountName, business: account.business, offer: account.offer,
    channel: onboarding.primaryChannel ?? "moments_post" as ContentChannel, industry,
    profileVersion: currentProfile?.version ?? 0, confirmedProfile,
    draftProfile: currentProfile?.status === "draft" && currentProfile.starterTemplate ? currentProfile : null,
    options: voices.map((voice) => ({ ...voice, sample: buildStarterStyle(account, industry, voice.id).examples[0].excerpt })), topics,
  };
}
export type FirstContentSnapshot = Awaited<ReturnType<typeof getFirstContentSnapshot>>;

export async function previewStarterStyle(input: { industry: unknown; voice: unknown; adjustments: unknown; version: number }) {
  if (!isIndustry(input.industry) || !isVoice(input.voice)) throw new InterviewError("请选择行业和一种口吻。");
  if (typeof input.adjustments !== "string" || input.adjustments.length > 500) throw new InterviewError("口吻补充请控制在 500 字以内。");
  const profile = buildStarterStyle(await requiredAccount(), input.industry, input.voice, input.adjustments);
  const confirmed = await getConfirmedStyleProfile();
  if (confirmed) {
    profile.persona = confirmed.persona;
    profile.readerRelationship = confirmed.readerRelationship;
    profile.rules = [...confirmed.rules.filter((rule) => !rule.id.startsWith("starter-rule-")), ...profile.rules];
    profile.examples = [...profile.examples, ...confirmed.examples.filter((example) => example.id !== "starter-example")];
    profile.sources = [...new Map([...confirmed.sources, ...profile.sources].map((source) => [source.id, source])).values()];
    profile.preferredPhrases = [...new Set([...confirmed.preferredPhrases, ...profile.preferredPhrases])];
    profile.bannedPhrases = [...new Set([...confirmed.bannedPhrases, ...profile.bannedPhrases])];
    profile.channelOverrides = confirmed.channelOverrides;
    profile.values = confirmed.values;
  }
  return saveCurrentStyleProfile(profile, "draft", input.version);
}

export async function confirmStarterStyle(version: number) {
  await requiredAccount();
  const profile = await getCurrentStyleProfile();
  if (!profile?.starterTemplate || profile.status !== "draft" || profile.version !== version) throw new InterviewError("请先保存当前口吻预览，或刷新查看最新风格。", 409);
  const issues = validateStyleProfileForConfirmation(profile);
  if (issues.length) throw new InterviewError(issues.join("；"), 422);
  return saveCurrentStyleProfile(profile, "confirmed", version);
}

export async function generateFirstContent(topicId: unknown, styleVersion: number) {
  const account = await requiredAccount();
  const [profile, knowledge, onboarding] = await Promise.all([
    getConfirmedStyleProfile(), getConfirmedKnowledgeProfile(), getStoredOnboardingStatus(),
  ]);
  if (!profile || profile.version !== styleVersion) throw new InterviewError("请先确认口吻；风格有更新时刷新后再创作。", 409);
  const topic = starterTopics(account).find((item) => item.id === topicId);
  if (!topic) throw new InterviewError("请选择当前企业的一个建议选题。");
  const channel = onboarding.primaryChannel ?? "moments_post";
  const id = ideaId(account, topic.id);
  const projectId = `first_${id}`;
  let project = await getContentProject(projectId);
  const sources: BriefKnowledgeSource[] = [{
    id: `confirmed-account:${account.updatedAt}`, title: "用户已确认的经营信息", source: "upload",
    text: JSON.stringify({ name: account.accountName, business: account.business, offer: account.offer, goal: account.conversionGoal, answers: account.answeredQuestions ?? [], note: "没有提供的产品细节和个人经历不能补造。" }),
  }, ...(knowledge ? [{ id: `confirmed-knowledge:v${knowledge.version}`, title: `已确认企业知识档案 v${knowledge.version}`, source: "upload" as const, text: formatKnowledgeProfileForPrompt(knowledge) }] : [])];
  if (!project) {
    if (!await getIdeaFromDb(id)) await saveIdeaToDb({ id, title: topic.title, summary: topic.reason, platform: channelLabels[channel], status: "pool" });
    const style = compileStyleContract(profile);
    const brief = await createContentBrief(topic.title, account, sources, null, style, await getIdeaContext(id), null, knowledge);
    project = await saveContentProject({ id: projectId, topic: topic.title, brief, accountSnapshot: account, styleSnapshot: style, knowledgeProfileVersion: knowledge?.version });
  }
  const existing = project.channelDrafts.find((draft) => draft.channel === channel && draft.status === "generated");
  if (existing) return { project, channel };
  try {
    const draft = await generateChannelDraft({ channel, brief: project.brief, sources, accountContext: project.accountSnapshot, styleContract: project.styleSnapshot });
    project = (await replaceChannelDraft(project.id, draft, true))!;
    if (project.channelDrafts.find((item) => item.channel === channel)?.updatedAt !== draft.updatedAt) return { project, channel };
    const review = await reviewChannelDraft({ project, draft });
    project = await saveChannelReview(project.id, channel, review);
    return { project, channel };
  } catch (error) {
    const saved = await replaceChannelDraft(project.id, { channel, content: "", status: "failed", error: error instanceof Error ? error.message : "生成未完成，请重试。", updatedAt: new Date().toISOString() }, true);
    if (saved?.channelDrafts.some((item) => item.channel === channel && item.status === "generated")) return { project: saved, channel };
    throw error;
  }
}
