import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { listContentLibraryItems } from "@/modules/drafts/server/repository";
import { getContentPlan, markPlanItemsReviewed } from "@/modules/plans/repository";
import { confirmWeeklyReview, saveWeeklyReview } from "./repository";
import type {
  ReviewSuggestion,
  ReviewSuggestionEvidence,
  WeeklyReview,
  WeeklyReviewPublication,
} from "./types";

const minimumSampleSize = 2;

export class WeeklyReviewError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function generateWeeklyReview(contentPlanId: string, week: number) {
  const { plan, publications, dataGaps } = await loadReviewContext(contentPlanId, week);
  const now = new Date().toISOString();
  const reviewId = `${contentPlanId}:week:${week}`;

  if (publications.length < minimumSampleSize) {
    return saveWeeklyReview({
      id: reviewId,
      contentPlanId,
      week,
      sampleSize: publications.length,
      continue: [],
      reduce: [],
      adjust: [],
      dataGaps: [
        `本周至少需要 ${minimumSampleSize} 条有真实指标或主观反馈的发布记录，当前只有 ${publications.length} 条。`,
        ...dataGaps,
      ],
      createdAt: now,
    });
  }

  const response = asRecord(parseJsonObject(await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是企业内容运营复盘顾问。只输出 JSON，不要 Markdown。",
        "输出 continue、reduce、adjust、dataGaps 四个字段。前三项都是数组，每项包含 title、rationale、evidence。",
        "每条 evidence 必须原样引用输入中的 contentPlanItemId、publicationId，并写一条简短 label。",
        "只根据给定真实数据判断，不补造增长、行业基准或因果关系。",
      ].join(""),
    },
    {
      role: "user",
      content: JSON.stringify({
        plan: { title: plan.title, operatingGoal: plan.operatingGoal, week },
        publications,
      }),
    },
  ])));
  const allowedEvidence = new Map(publications.map((item) => [
    `${item.contentPlanItemId}:${item.publicationId}`,
    item,
  ]));
  const review: WeeklyReview = {
    id: reviewId,
    contentPlanId,
    week,
    sampleSize: publications.length,
    continue: normalizeSuggestions(response.continue, allowedEvidence),
    reduce: normalizeSuggestions(response.reduce, allowedEvidence),
    adjust: normalizeSuggestions(response.adjust, allowedEvidence),
    dataGaps: uniqueStrings(response.dataGaps).concat(dataGaps),
    createdAt: now,
  };
  if (![...review.continue, ...review.reduce, ...review.adjust].length) {
    throw new WeeklyReviewError("复盘没有返回可验证的建议，请稍后重试。", 502);
  }
  return saveWeeklyReview(review);
}

export async function confirmReview(contentPlanId: string, reviewId: string) {
  const review = await confirmWeeklyReview(contentPlanId, reviewId);
  if (!review) throw new WeeklyReviewError("周复盘不存在。", 404);
  if (!review.sampleSize) return review;

  const { publications } = await loadReviewContext(contentPlanId, review.week);
  await markPlanItemsReviewed(
    contentPlanId,
    publications.map((item) => ({
      itemId: item.contentPlanItemId,
      publicationId: item.publicationId,
    })),
  );
  return review;
}

async function loadReviewContext(contentPlanId: string, week: number) {
  const [plan, libraryItems] = await Promise.all([
    getContentPlan(contentPlanId),
    listContentLibraryItems(),
  ]);
  if (!plan) throw new WeeklyReviewError("内容计划不存在。", 404);
  const weekItems = plan.items.filter((item) => item.week === week);
  if (!weekItems.length) throw new WeeklyReviewError("这一周没有计划选题。", 404);
  const planItemById = new Map(weekItems.map((item) => [item.id, item]));
  const publications = libraryItems.flatMap((item): WeeklyReviewPublication[] => {
    if (!item.publication || !item.contentPlanItemId) return [];
    const planItem = planItemById.get(item.contentPlanItemId);
    if (!planItem || item.contentPlanId !== contentPlanId || !hasRealFeedback(item.publication)) return [];
    return [{
      contentPlanItemId: planItem.id,
      publicationId: item.publication.id,
      title: planItem.title,
      channel: item.channel,
      views: item.publication.metrics.views,
      likes: item.publication.metrics.likes,
      collects: item.publication.metrics.saves,
      comments: item.publication.metrics.comments,
      leads: item.publication.feedback?.leads ?? 0,
      qualitativeFeedback: item.publication.feedback?.qualitativeFeedback,
      authorAssessment: item.publication.feedback?.authorAssessment,
    }];
  });
  const publishedPlanItems = new Set(
    libraryItems
      .filter((item) => item.contentPlanId === contentPlanId && item.publication)
      .map((item) => item.contentPlanItemId),
  );
  const missingFeedbackCount = weekItems.filter((item) =>
    item.contentProjectId && !publishedPlanItems.has(item.id),
  ).length;
  return {
    plan,
    publications,
    dataGaps: missingFeedbackCount
      ? [`本周还有 ${missingFeedbackCount} 个已开始的选题没有可用发布反馈。`]
      : [],
  };
}

function hasRealFeedback(publication: Awaited<ReturnType<typeof listContentLibraryItems>>[number]["publication"]) {
  if (!publication) return false;
  return Object.values(publication.metrics).some((value) => value > 0)
    || Boolean(publication.feedback?.qualitativeFeedback)
    || Boolean(publication.feedback?.authorAssessment)
    || (publication.feedback?.leads ?? 0) > 0;
}

function normalizeSuggestions(
  value: unknown,
  allowed: Map<string, WeeklyReviewPublication>,
): ReviewSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((entry) => {
    const record = asRecord(entry);
    const title = text(record.title, 160);
    const rationale = text(record.rationale, 600);
    const evidence = normalizeEvidence(record.evidence, allowed);
    return title && rationale && evidence.length ? [{ title, rationale, evidence }] : [];
  });
}

function normalizeEvidence(
  value: unknown,
  allowed: Map<string, WeeklyReviewPublication>,
): ReviewSuggestionEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((entry) => {
    const record = asRecord(entry);
    const contentPlanItemId = text(record.contentPlanItemId, 200);
    const publicationId = text(record.publicationId, 300);
    const source = allowed.get(`${contentPlanItemId}:${publicationId}`);
    if (!source) return [];
    return [{
      contentPlanItemId,
      publicationId,
      label: text(record.label, 240) || `${source.title} 的真实发布数据`,
    }];
  });
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => text(item, 300)).filter(Boolean)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}
