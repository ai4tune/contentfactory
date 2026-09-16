import {
  authorAssessments,
  type AuthorAssessment,
  type PublicationFeedback,
  type PublicationMetrics,
} from "../types";

export class PublicationValidationError extends Error {}

export function parsePublicationFeedback(value: unknown) {
  const record = asRecord(value);
  const publishedAt = normalizeDate(record.publishedAt);
  if (!publishedAt) throw new PublicationValidationError("请选择有效的发布时间。");

  const url = optionalString(record.url);
  if (url && !isHttpUrl(url)) {
    throw new PublicationValidationError("发布链接必须以 http:// 或 https:// 开头。");
  }

  const metricsRecord = asRecord(record.metrics);
  const metrics: PublicationMetrics = {
    views: toCount(metricsRecord.views),
    likes: toCount(metricsRecord.likes),
    saves: toCount(metricsRecord.saves ?? metricsRecord.collects),
    comments: toCount(metricsRecord.comments),
    replies: toCount(metricsRecord.replies),
  };
  const leads = toCount(record.leads);
  const qualitativeFeedback = optionalString(record.qualitativeFeedback)?.slice(0, 2_000);
  const authorAssessment = authorAssessments.includes(record.authorAssessment as AuthorAssessment)
    ? record.authorAssessment as AuthorAssessment
    : undefined;
  const recordedAt = new Date().toISOString();
  const feedback: PublicationFeedback = {
    views: metrics.views,
    likes: metrics.likes,
    collects: metrics.saves,
    comments: metrics.comments,
    leads,
    qualitativeFeedback,
    authorAssessment,
    recordedAt,
  };

  return { url, publishedAt, metrics, feedback };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toCount(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) {
    throw new PublicationValidationError("发布数据必须是大于或等于 0 的数字。");
  }
  return Math.round(count);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
