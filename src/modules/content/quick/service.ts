import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { createContentBrief } from "@/modules/content/server/brief-service";
import {
  getContentProject,
  replaceChannelDraft,
  saveContentProject,
} from "@/modules/content/server/project-repository";
import type { BriefKnowledgeSource, ContentProject } from "@/modules/content/types";
import { getActiveAccountContext } from "@/modules/positioning/service";
import {
  getContentPlan,
  linkContentProjectToPlanItem,
  markPlanItemGenerated,
} from "@/modules/plans/repository";
import type { ContentPlan, ContentPlanItem } from "@/modules/plans/types";
import { saveChannelReview } from "@/modules/reviews/server/repository";
import { reviewChannelDraft } from "@/modules/reviews/service";
import { getActiveStyleContract } from "@/modules/style-profile/service";
import { QuickRequestError } from "./request";
import type {
  KnowledgeRecommendation,
  QuickCreationInput,
  QuickKnowledgeCandidate,
} from "./types";

type QuickPlanContext = { plan: ContentPlan; item: ContentPlanItem };

export async function recommendQuickKnowledge(input: {
  contentPlanId: string;
  contentPlanItemId: string;
  candidates: QuickKnowledgeCandidate[];
}) {
  const { plan, item } = await getQuickPlanContext(input);
  if (!input.candidates.length) return [];

  const response = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是企业内容创作的知识匹配编辑。只输出 JSON，不要 Markdown。",
        "输出 recommendations 数组，每项包含 refId, sourceType, reason, excerpts, selected。",
        "只能选择候选清单中存在的资料。reason 说明这份资料如何支撑当前选题；excerpts 必须逐字来自候选摘要，不能补造。",
        "优先选择 1～3 份最相关资料；不相关资料 selected=false。没有足够依据时可以全部不选。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `经营目标：${plan.operatingGoal}`,
        `主渠道：${plan.primaryChannel}`,
        `选题：${item.title}`,
        `内容角度：${item.angle || "未指定"}`,
        `内容目的：${item.objective}`,
        `推荐理由：${item.rationale}`,
        `计划依据：${JSON.stringify(item.evidence)}`,
        "候选资料：",
        JSON.stringify(input.candidates),
      ].join("\n"),
    },
  ]);

  return normalizeRecommendations(parseJsonObject(response), input.candidates);
}

export async function generateQuickContent(input: QuickCreationInput) {
  const { plan, item } = await getQuickPlanContext(input);
  const channel = input.channel ?? plan.primaryChannel;
  let project = item.contentProjectId
    ? await getContentProject(item.contentProjectId)
    : null;

  if (project && (
    project.contentPlanId !== plan.id
    || project.contentPlanItemId !== item.id
  )) {
    throw new QuickRequestError("计划选题关联的内容项目不一致，请返回计划页检查。", 409);
  }

  if (!project) {
    const [accountSnapshot, styleSnapshot] = await Promise.all([
      getActiveAccountContext(),
      getActiveStyleContract(),
    ]);
    const brief = await createContentBrief(
      item.title,
      accountSnapshot,
      input.sources,
      null,
      styleSnapshot,
      null,
      {
        operatingGoal: plan.operatingGoal,
        objective: item.objective,
        angle: item.angle,
        rationale: item.rationale,
      },
    );
    project = await saveContentProject({
      topic: item.title,
      brief,
      contentPlanId: plan.id,
      contentPlanItemId: item.id,
      accountSnapshot,
      styleSnapshot,
    });
    await linkContentProjectToPlanItem(plan.id, item.id, project.id);
  }

  ensureRequiredSources(project, input.sources);
  let draft = project.channelDrafts.find((candidate) => candidate.channel === channel && candidate.status === "generated");
  if (!draft) {
    draft = await generateChannelDraft({
      channel,
      brief: project.brief,
      sources: input.sources,
      accountContext: project.accountSnapshot,
      styleContract: project.styleSnapshot,
    });
    const updated = await replaceChannelDraft(project.id, draft);
    if (!updated) throw new QuickRequestError("内容项目保存失败，请重试。", 500);
    project = updated;
  }

  if (!draft.review) {
    const review = await reviewChannelDraft({ project, draft });
    project = await saveChannelReview(project.id, channel, review);
  }
  await markPlanItemGenerated(plan.id, item.id, project.id);
  return { project, channel };
}

export async function getQuickPlanContext(input: {
  contentPlanId: string;
  contentPlanItemId: string;
}): Promise<QuickPlanContext> {
  const plan = await getContentPlan(input.contentPlanId);
  if (!plan) throw new QuickRequestError("内容计划不存在。", 404);
  if (plan.status !== "confirmed") {
    throw new QuickRequestError("请先确认本周内容计划，再开始快速创作。", 409);
  }
  const item = plan.items.find((candidate) => candidate.id === input.contentPlanItemId);
  if (!item) throw new QuickRequestError("计划选题不存在。", 404);
  return { plan, item };
}

function normalizeRecommendations(
  value: unknown,
  candidates: QuickKnowledgeCandidate[],
): KnowledgeRecommendation[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidateMap = new Map(candidates.map((candidate) => [candidateKey(candidate), candidate]));
  const ranked: KnowledgeRecommendation[] = [];
  const seen = new Set<string>();
  const raw = Array.isArray(record.recommendations) ? record.recommendations : [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const result = item as Record<string, unknown>;
    const key = `${String(result.sourceType ?? "")}:${String(result.refId ?? "")}`;
    const candidate = candidateMap.get(key);
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      refId: candidate.refId,
      title: candidate.title,
      sourceType: candidate.sourceType,
      reason: String(result.reason ?? "").trim().slice(0, 500) || "与当前选题相关，请人工确认是否采用。",
      excerpts: verifiedExcerpts(result.excerpts, candidate.excerpt),
      selected: result.selected === true,
    });
  }

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    ranked.push({
      refId: candidate.refId,
      title: candidate.title,
      sourceType: candidate.sourceType,
      reason: "未被 AI 优先选择，可由你手工加入。",
      excerpts: candidate.excerpt ? [candidate.excerpt.slice(0, 260)] : [],
      selected: false,
    });
  }

  return ranked;
}

function verifiedExcerpts(value: unknown, sourceExcerpt?: string) {
  if (!sourceExcerpt) return [];
  const requested = Array.isArray(value) ? value : [];
  const excerpts = requested
    .map((item) => String(item ?? "").trim())
    .filter((item) => item && sourceExcerpt.includes(item))
    .slice(0, 3);
  return excerpts.length ? excerpts : [sourceExcerpt.slice(0, 260)];
}

function candidateKey(candidate: Pick<QuickKnowledgeCandidate, "refId" | "sourceType">) {
  return `${candidate.sourceType}:${candidate.refId}`;
}

function ensureRequiredSources(project: ContentProject, sources: BriefKnowledgeSource[]) {
  const sourceIds = new Set(sources.map((source) => source.id));
  if (project.brief.citations.some((citation) => !sourceIds.has(citation.sourceId))) {
    throw new QuickRequestError("请保留简报已经引用的企业资料后再重试生成。", 400);
  }
}
