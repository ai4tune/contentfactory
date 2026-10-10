import { createHash } from "node:crypto";
import { getIdeaFromDb, saveIdeaToDb } from "@/lib/db";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { createContentBrief } from "@/modules/content/server/brief-service";
import { getContentProject, replaceChannelDraft, saveContentProject } from "@/modules/content/server/project-repository";
import { channelLabels, isContentChannel, type BriefKnowledgeSource, type ContentChannel } from "@/modules/content/types";
import { getIdeaContext } from "@/modules/ideas/service";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { formatKnowledgeProfileForPrompt } from "@/modules/knowledge-profile/service";
import { getActiveAccountContext } from "@/modules/positioning/service";
import type { AccountContext } from "@/modules/positioning/types";
import { saveChannelReview } from "@/modules/reviews/server/repository";
import { reviewChannelDraft } from "@/modules/reviews/service";
import { getCurrentStyleProfile, getConfirmedStyleProfile, saveCurrentStyleProfile } from "@/modules/style-profile/repository";
import { validateStyleProfileForConfirmation } from "@/modules/style-profile/request";
import { normalizeTemporaryStyleInstructions } from "@/modules/style-profile/request";
import { compileStyleContract } from "@/modules/style-profile/compiler";
import { getInterviewState } from "../interview-repository";
import { InterviewError } from "../interview";
import { getStoredOnboardingStatus } from "../repository";
import { buildStarterStyle, isIndustry, isVoice, mergeStarterStyle, starterTopics, styleDifferences, voices, type IndustryId } from "./catalog";

export async function getFirstContentAccount(): Promise<AccountContext | null> {
  const [account, knowledge, interview] = await Promise.all([getActiveAccountContext(), getConfirmedKnowledgeProfile(), getInterviewState()]);
  const confirmation = interview.confirmedBusiness;
  if (account && (!confirmation?.confirmedAt || confirmation.confirmedAt <= account.updatedAt)) return account;
  if (!knowledge?.businessSummary.trim()) return null;
  const answers = confirmation?.confirmedAt ? confirmation.answers : null;
  if (account && answers) {
    const businessChanged = account.accountName !== answers.accountName || account.business !== answers.business;
    return {
      ...account, accountName: answers.accountName, business: answers.business, offer: answers.offer || answers.business,
      conversionGoal: answers.goal || (businessChanged ? "" : account.conversionGoal),
      ...(businessChanged ? { status: "skipped" as const, accountPosition: "", contentPillars: [], contentDirections: [], recommendedTopics: [],
        targetAudience: answers.audience && !/不确定|不知道/.test(answers.audience) ? [answers.audience] : [] } : {}),
      answeredQuestions: undefined, updatedAt: knowledge.updatedAt,
    };
  }
  // 用于本篇的事实快照，不保存或确认一份新的运营定位。
  return {
    id: "current-account", status: "skipped", source: "manual", accountName: knowledge.name,
    business: knowledge.businessSummary, offer: knowledge.offers.map((offer) => offer.name).join("、") || knowledge.businessSummary,
    accountPosition: "", platforms: [], targetAudience: knowledge.targetCustomers,
    conversionGoal: knowledge.businessGoals.join("、"), contentPillars: [],
    brandVoice: [answers?.tone || "自然、清楚，先介绍真实业务"], preferredPhrases: [], bannedPhrases: knowledge.forbiddenClaims,
    contentDirections: [], recommendedTopics: [], analysisEvidence: ["来自用户已确认的经营资料，未确认长期运营方向。"],
    informationGaps: knowledge.gaps, updatedAt: knowledge.updatedAt,
  };
}

async function requiredAccount() {
  const account = await getFirstContentAccount();
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
    channel: onboarding.primaryChannel ?? "xiaohongshu_note" as ContentChannel, industry,
    positioningConfirmed: account.status === "confirmed",
    profileVersion: currentProfile?.version ?? 0, confirmedProfile,
    draftProfile: currentProfile?.status === "draft" && currentProfile.starterTemplate ? currentProfile : null,
    options: voices.map((voice) => ({ ...voice, sample: buildStarterStyle(account, industry, voice.id).examples[0].excerpt })), topics,
  };
}
export type FirstContentSnapshot = Awaited<ReturnType<typeof getFirstContentSnapshot>>;

export async function compareStarterStyle(input: { industry: unknown; voice: unknown; adjustments: unknown; version: number }) {
  const industry = input.industry ?? "general";
  if (!isIndustry(industry) || !isVoice(input.voice)) throw new InterviewError("请选择有效的口吻配置。");
  if (typeof input.adjustments !== "string" || input.adjustments.length > 500) throw new InterviewError("口吻补充请控制在 500 字以内。");
  const profile = buildStarterStyle(await requiredAccount(), industry, input.voice, input.adjustments);
  const [current, confirmed] = await Promise.all([getCurrentStyleProfile(), getConfirmedStyleProfile()]);
  if ((current?.version ?? 0) !== input.version) throw new InterviewError("风格已更新，请刷新后查看差异。", 409);
  const candidate = mergeStarterStyle(profile, current ?? confirmed);
  return { profile: candidate, differences: styleDifferences(confirmed, candidate) };
}

export async function previewStarterStyle(input: { industry: unknown; voice: unknown; adjustments: unknown; version: number }) {
  const { profile } = await compareStarterStyle(input);
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

export async function generateFirstContent(topicId: unknown, styleVersion: number, options: {
  topic?: unknown; channel?: unknown; useDefaultStyle?: boolean; temporaryStyleInstructions?: unknown;
} = {}) {
  const account = await requiredAccount();
  const [profile, knowledge, onboarding] = await Promise.all([
    getConfirmedStyleProfile(), getConfirmedKnowledgeProfile(), getStoredOnboardingStatus(),
  ]);
  if (profile ? profile.version !== styleVersion : !options.useDefaultStyle || styleVersion !== 0) {
    throw new InterviewError("请确认口吻或选择先用自然表达；风格有更新时刷新后再创作。", 409);
  }
  if (options.topic !== undefined && (typeof options.topic !== "string" || !options.topic.trim() || options.topic.length > 200)) {
    throw new InterviewError("请填写 200 字以内的选题。");
  }
  if (options.channel !== undefined && !isContentChannel(options.channel)) throw new InterviewError("请选择有效的发布渠道。");
  const topic = typeof options.topic === "string"
    ? { id: `own:${options.topic.trim()}`, title: options.topic.trim(), reason: "用户自己的选题，基于已确认的经营资料创作。" }
    : starterTopics(account).find((item) => item.id === topicId);
  if (!topic) throw new InterviewError("请选择当前企业的一个建议选题。");
  const defaultChannel = onboarding.primaryChannel ?? "xiaohongshu_note";
  const channel = isContentChannel(options.channel) ? options.channel : defaultChannel;
  const temporaryStyleInstructions = normalizeTemporaryStyleInstructions(options.temporaryStyleInstructions);
  const id = ideaId(account, channel === defaultChannel ? topic.id : `${topic.id}:${channel}`);
  const projectId = `first_${id}${temporaryStyleInstructions.length ? `_style_${createHash("sha256").update(JSON.stringify(temporaryStyleInstructions)).digest("hex").slice(0, 12)}` : ""}`;
  let project = await getContentProject(projectId);
  const sources: BriefKnowledgeSource[] = [{
    id: `confirmed-account:${account.updatedAt}`, title: "用户已确认的经营信息", source: "upload",
    text: JSON.stringify({ name: account.accountName, business: account.business, offer: account.offer, goal: account.conversionGoal, answers: account.answeredQuestions ?? [], note: "没有提供的产品细节和个人经历不能补造。" }),
  }, ...(knowledge ? [{ id: `confirmed-knowledge:v${knowledge.version}`, title: `已确认企业知识档案 v${knowledge.version}`, source: "upload" as const, text: formatKnowledgeProfileForPrompt(knowledge) }] : [])];
  if (!project) {
    if (!await getIdeaFromDb(id)) await saveIdeaToDb({ id, title: topic.title, summary: topic.reason, platform: channelLabels[channel], status: "pool" });
    const style = profile ? compileStyleContract(profile, { temporaryInstructions: temporaryStyleInstructions }) : null;
    const brief = await createContentBrief(topic.title, account, sources, null, style, await getIdeaContext(id), null, knowledge);
    if (!account.conversionGoal) brief.contentGoal = "先介绍清楚本次真实业务";
    project = await saveContentProject({ id: projectId, topic: topic.title, brief, accountSnapshot: account, styleSnapshot: style, temporaryStyleInstructions, knowledgeProfileVersion: knowledge?.version });
  }
  const existing = project.channelDrafts.find((draft) => draft.channel === channel && draft.status === "generated");
  if (existing) return { project, channel };
  try {
    const draft = await generateChannelDraft({ topic: project.topic, channel, brief: project.brief, sources, accountContext: project.accountSnapshot, styleContract: project.styleSnapshot, temporaryStyleInstructions: project.temporaryStyleInstructions });
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
