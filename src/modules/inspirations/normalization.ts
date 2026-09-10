import { createHash } from "node:crypto";
import type { InspirationResult } from "@/lib/ai";
import {
  inspirationSchemaVersion,
  type InspirationAuthor,
  type InspirationCaptureInput,
  type InspirationCaptureMethod,
  type InspirationContentType,
  type InspirationMetric,
  type InspirationMetrics,
  type InspirationRecord,
  type InspirationUsage,
} from "@/modules/inspirations/types";

const metricKeys = ["likes", "collects", "comments", "shares", "views"] as const;

export class InspirationValidationError extends Error {}

export function parseInspirationCaptureInput(
  value: unknown,
  defaults: { captureMethod: InspirationCaptureMethod; accountPosition?: string },
): InspirationCaptureInput {
  const record = objectRecord(value);
  if (!record) throw new InspirationValidationError("请求内容必须是一个对象");

  const platform = requiredString(record.platform, "平台");
  const title = requiredString(record.title, "标题");
  const content = requiredString(record.content ?? record.body, "正文");
  const sourceUrl = optionalHttpUrl(record.sourceUrl ?? record.url, "原文链接");
  const platformContentId = optionalString(record.platformContentId)
    ?? extractPlatformContentId(platform, sourceUrl);
  const capturedAt = optionalIsoDate(record.capturedAt, "采集时间") ?? new Date().toISOString();
  const contentType = parseContentType(record.contentType ?? record.type);
  const imageUrls = parseUrlArray(record.imageUrls, 20);
  const coverUrl = optionalHttpUrl(record.coverUrl, "封面链接") ?? imageUrls[0];
  const metricsSummary = typeof record.metrics === "string"
    ? optionalString(record.metrics)
    : optionalString(record.metricsSummary);

  return {
    platform,
    sourceUrl,
    platformContentId,
    captureMethod: parseCaptureMethod(record.captureMethod) ?? defaults.captureMethod,
    title,
    content,
    contentType,
    tags: stringArray(record.tags, 30),
    imageUrls,
    coverUrl,
    author: parseAuthor(record.author),
    publishedAt: optionalIsoDate(record.publishedAt, "发布时间"),
    capturedAt,
    sourceKeyword: optionalString(record.sourceKeyword),
    contentDirection: optionalString(record.contentDirection),
    searchTaskId: optionalString(record.searchTaskId),
    accountPosition: optionalString(record.accountPosition) ?? defaults.accountPosition,
    metrics: parseMetrics(record.metrics, metricsSummary),
    metricsSummary,
  };
}

export function normalizeInspirationRecords(value: unknown): InspirationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeInspirationRecord).filter((item): item is InspirationRecord => Boolean(item));
}

export function normalizeInspirationRecord(value: unknown): InspirationRecord | null {
  const record = objectRecord(value);
  if (!record) return null;
  return record.schemaVersion === inspirationSchemaVersion
    ? normalizeVersionTwoRecord(record)
    : normalizeLegacyRecord(record);
}

export function buildInspirationRecord(
  input: InspirationCaptureInput,
  analysis: InspirationResult,
  id: string,
): InspirationRecord {
  const capturedAt = input.capturedAt;
  const snapshot = createMetricSnapshot(input);

  return {
    schemaVersion: inspirationSchemaVersion,
    id,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    firstCapturedAt: capturedAt,
    lastCapturedAt: capturedAt,
    dedupeKey: createInspirationDedupeKey(input),
    source: {
      platform: input.platform,
      platformContentId: input.platformContentId,
      sourceUrl: input.sourceUrl,
      canonicalUrl: canonicalizeUrl(input.sourceUrl),
      captureMethod: input.captureMethod,
    },
    content: {
      title: input.title,
      body: input.content,
      contentType: input.contentType,
      tags: input.tags,
      imageUrls: input.imageUrls,
      coverUrl: input.coverUrl,
      publishedAt: input.publishedAt,
    },
    author: input.author,
    discovery: {
      sourceKeyword: input.sourceKeyword,
      contentDirection: input.contentDirection,
      searchTaskId: input.searchTaskId,
    },
    metrics: input.metrics,
    metricSnapshots: snapshot ? [snapshot] : [],
    analysis,
    usage: emptyUsage(),
  };
}

export function mergeInspirationRecord(
  current: InspirationRecord,
  input: InspirationCaptureInput,
  analysis: InspirationResult,
): InspirationRecord {
  const snapshot = createMetricSnapshot(input);
  const canonicalUrl = canonicalizeUrl(input.sourceUrl);

  return {
    ...current,
    updatedAt: input.capturedAt,
    lastCapturedAt: input.capturedAt,
    dedupeKey: createInspirationDedupeKey(input),
    source: {
      platform: input.platform,
      platformContentId: input.platformContentId ?? current.source.platformContentId,
      sourceUrl: input.sourceUrl ?? current.source.sourceUrl,
      canonicalUrl: canonicalUrl ?? current.source.canonicalUrl,
      captureMethod: input.captureMethod,
    },
    content: {
      title: input.title,
      body: input.content || current.content.body,
      contentType: input.contentType === "unknown" ? current.content.contentType : input.contentType,
      tags: input.tags.length ? input.tags : current.content.tags,
      imageUrls: input.imageUrls.length ? input.imageUrls : current.content.imageUrls,
      coverUrl: input.coverUrl ?? current.content.coverUrl,
      publishedAt: input.publishedAt ?? current.content.publishedAt,
    },
    author: mergeAuthor(current.author, input.author),
    discovery: {
      sourceKeyword: input.sourceKeyword ?? current.discovery.sourceKeyword,
      contentDirection: input.contentDirection ?? current.discovery.contentDirection,
      searchTaskId: input.searchTaskId ?? current.discovery.searchTaskId,
    },
    metrics: mergeMetrics(current.metrics, input.metrics),
    metricSnapshots: snapshot
      ? [...current.metricSnapshots, snapshot].slice(-50)
      : current.metricSnapshots,
    analysis: mergeAnalysis(current.analysis, analysis),
  };
}

export function createInspirationDedupeKey(input: Pick<
  InspirationCaptureInput,
  "platform" | "platformContentId" | "sourceUrl" | "title" | "content"
>) {
  const platform = normalizePlatformIdentity(input.platform);
  const platformContentId = optionalString(input.platformContentId)
    ?? extractPlatformContentId(input.platform, input.sourceUrl);
  if (platformContentId) return `${platform}:id:${normalizeKey(platformContentId)}`;

  const canonicalUrl = canonicalizeUrl(input.sourceUrl);
  if (canonicalUrl) return `${platform}:url:${canonicalUrl}`;

  const fingerprint = createHash("sha256")
    .update(`${platform}\n${normalizeKey(input.title)}\n${normalizeKey(input.content)}`)
    .digest("hex")
    .slice(0, 24);
  return `${platform}:content:${fingerprint}`;
}

export function canonicalizeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizePlatformIdentity(value: string) {
  const platform = normalizeKey(value);
  if (platform.includes("小红书") || platform.includes("xiaohongshu") || platform === "xhs") {
    return "xiaohongshu";
  }
  if (platform.includes("公众号") || platform.includes("mp.weixin") || platform.includes("wechat")) {
    return "wechat_official_account";
  }
  if (platform.includes("视频号") || platform.includes("channels")) return "wechat_channels";
  return platform;
}

export function formatInspirationMetrics(metrics: InspirationMetrics, rawSummary?: string) {
  const labels: Record<(typeof metricKeys)[number], string> = {
    likes: "点赞",
    collects: "收藏",
    comments: "评论",
    shares: "分享",
    views: "阅读/播放",
  };
  const values = metricKeys.flatMap((key) => {
    const metric = metrics[key];
    if (metric.value === null && !metric.raw) return [];
    return [`${labels[key]} ${metric.raw || metric.value}`];
  });
  return values.join(" · ") || rawSummary || undefined;
}

function normalizeVersionTwoRecord(record: Record<string, unknown>): InspirationRecord | null {
  const id = optionalString(record.id);
  const source = objectRecord(record.source);
  const content = objectRecord(record.content);
  const analysis = normalizeAnalysis(record.analysis);
  if (!id || !source || !content || !analysis) return null;

  const platform = optionalString(source.platform);
  const title = optionalString(content.title);
  const body = optionalString(content.body) ?? "";
  if (!platform || !title) return null;

  const createdAt = safeIsoDate(record.createdAt) ?? new Date(0).toISOString();
  const input: InspirationCaptureInput = {
    platform,
    sourceUrl: optionalString(source.sourceUrl ?? source.canonicalUrl),
    platformContentId: optionalString(source.platformContentId),
    captureMethod: parseCaptureMethod(source.captureMethod) ?? "manual",
    title,
    content: body,
    contentType: parseContentType(content.contentType),
    tags: stringArray(content.tags, 30),
    imageUrls: parseUrlArray(content.imageUrls, 20),
    coverUrl: safeHttpUrl(content.coverUrl),
    author: parseAuthor(record.author),
    publishedAt: safeIsoDate(content.publishedAt),
    capturedAt: safeIsoDate(record.lastCapturedAt) ?? createdAt,
    sourceKeyword: optionalString(objectRecord(record.discovery)?.sourceKeyword),
    contentDirection: optionalString(objectRecord(record.discovery)?.contentDirection),
    searchTaskId: optionalString(objectRecord(record.discovery)?.searchTaskId),
    metrics: parseMetrics(record.metrics),
  };
  const snapshots = Array.isArray(record.metricSnapshots)
    ? record.metricSnapshots.flatMap((item) => {
        const snapshot = objectRecord(item);
        const capturedAt = safeIsoDate(snapshot?.capturedAt);
        if (!snapshot || !capturedAt) return [];
        return [{
          capturedAt,
          metrics: parseMetrics(snapshot.metrics),
          rawSummary: optionalString(snapshot.rawSummary),
        }];
      })
    : [];

  return {
    ...buildInspirationRecord(input, analysis, id),
    createdAt,
    updatedAt: safeIsoDate(record.updatedAt) ?? createdAt,
    firstCapturedAt: safeIsoDate(record.firstCapturedAt) ?? createdAt,
    lastCapturedAt: safeIsoDate(record.lastCapturedAt) ?? createdAt,
    dedupeKey: optionalString(record.dedupeKey) ?? createInspirationDedupeKey(input),
    metricSnapshots: snapshots,
    usage: { ...normalizeUsage(record.usage), analysisStatus: normalizeUsage(record.usage).analysisStatus === "failed" ? "failed" : (Array.isArray(analysis.structure) && analysis.structure.length) || (Array.isArray(analysis.reusablePatterns) && analysis.reusablePatterns.length) ? "completed" : "pending" },
  };
}

function normalizeLegacyRecord(record: Record<string, unknown>): InspirationRecord | null {
  const id = optionalString(record.id);
  const input = objectRecord(record.input);
  const analysis = normalizeAnalysis(record.result);
  if (!id || !input || !analysis) return null;

  const platform = optionalString(input.platform);
  const title = optionalString(input.title);
  const content = optionalString(input.content);
  if (!platform || !title || !content) return null;

  const createdAt = safeIsoDate(record.createdAt) ?? new Date(0).toISOString();
  const metricsSummary = optionalString(input.metrics);
  return buildInspirationRecord({
    platform,
    sourceUrl: safeHttpUrl(input.sourceUrl),
    platformContentId: extractPlatformContentId(platform, safeHttpUrl(input.sourceUrl)),
    captureMethod: "manual",
    title,
    content,
    contentType: "unknown",
    tags: [],
    imageUrls: [],
    author: emptyAuthor(),
    capturedAt: createdAt,
    sourceKeyword: optionalString(input.sourceKeyword),
    accountPosition: optionalString(input.accountPosition),
    metrics: parseMetrics(metricsSummary, metricsSummary),
    metricsSummary,
  }, analysis, id);
}

function normalizeAnalysis(value: unknown): InspirationResult | null {
  const record = objectRecord(value);
  if (!record) return null;
  return {
    summary: String(record.summary ?? ""),
    targetAudience: String(record.targetAudience ?? ""),
    painPoint: String(record.painPoint ?? ""),
    hook: String(record.hook ?? ""),
    pacing: String(record.pacing ?? ""),
    evidence: stringArray(record.evidence, 30),
    callToAction: String(record.callToAction ?? ""),
    structure: stringArray(record.structure, 30),
    reusablePatterns: stringArray(record.reusablePatterns, 30),
    keywords: stringArray(record.keywords, 30),
    adaptationIdeas: stringArray(record.adaptationIdeas, 30),
    topicCandidates: stringArray(record.topicCandidates, 30),
    riskNotes: stringArray(record.riskNotes, 30),
  };
}

function parseMetrics(value: unknown, rawSummary?: string): InspirationMetrics {
  if (typeof value === "string") return parseMetricsText(value);
  const record = objectRecord(value);
  if (!record) return rawSummary ? parseMetricsText(rawSummary) : emptyMetrics();
  return {
    likes: parseMetric(record.likes),
    collects: parseMetric(record.collects ?? record.saves),
    comments: parseMetric(record.comments),
    shares: parseMetric(record.shares),
    views: parseMetric(record.views ?? record.plays),
  };
}

function parseMetricsText(value: string): InspirationMetrics {
  const find = (labels: string[]) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = value.match(new RegExp(`${escaped}\\s*[:：]?\\s*([\\d,.]+\\s*(?:万|w|W|k|K)?)`));
      if (match) return parseMetric(match[1]);
    }
    return nullMetric();
  };
  return {
    likes: find(["点赞", "赞"]),
    collects: find(["收藏", "获藏"]),
    comments: find(["评论"]),
    shares: find(["分享", "转发"]),
    views: find(["阅读", "播放", "观看"]),
  };
}

function parseMetric(value: unknown): InspirationMetric {
  const record = objectRecord(value);
  if (record) {
    const raw = optionalString(record.raw);
    const number = parseMetricNumber(record.value ?? raw);
    return { value: number, ...(raw ? { raw } : {}) };
  }
  if (typeof value === "number") return { value: validMetricNumber(value) };
  if (typeof value === "string") return { value: parseMetricNumber(value), raw: value.trim() };
  return nullMetric();
}

function parseMetricNumber(value: unknown) {
  if (typeof value === "number") return validMetricNumber(value);
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const match = normalized.match(/^([\d.]+)\s*(万|w|W|k|K)?/);
  if (!match) return null;
  const multiplier = /^(万|w)$/i.test(match[2] ?? "") ? 10_000 : /^k$/i.test(match[2] ?? "") ? 1_000 : 1;
  return validMetricNumber(Number(match[1]) * multiplier);
}

function validMetricNumber(value: number) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function mergeMetrics(current: InspirationMetrics, incoming: InspirationMetrics): InspirationMetrics {
  return Object.fromEntries(metricKeys.map((key) => [
    key,
    incoming[key].value !== null || incoming[key].raw ? incoming[key] : current[key],
  ])) as InspirationMetrics;
}

function mergeAnalysis(current: InspirationResult, incoming: InspirationResult): InspirationResult {
  return {
    summary: incoming.summary || current.summary,
    targetAudience: incoming.targetAudience || current.targetAudience,
    painPoint: incoming.painPoint || current.painPoint,
    hook: incoming.hook || current.hook,
    pacing: incoming.pacing || current.pacing,
    evidence: incoming.evidence.length ? incoming.evidence : current.evidence,
    callToAction: incoming.callToAction || current.callToAction,
    structure: incoming.structure.length ? incoming.structure : current.structure,
    reusablePatterns: incoming.reusablePatterns.length ? incoming.reusablePatterns : current.reusablePatterns,
    keywords: incoming.keywords.length ? incoming.keywords : current.keywords,
    adaptationIdeas: incoming.adaptationIdeas.length ? incoming.adaptationIdeas : current.adaptationIdeas,
    topicCandidates: incoming.topicCandidates.length ? incoming.topicCandidates : current.topicCandidates,
    riskNotes: incoming.riskNotes.length ? incoming.riskNotes : current.riskNotes,
  };
}

function createMetricSnapshot(input: InspirationCaptureInput) {
  const hasMetrics = metricKeys.some((key) => input.metrics[key].value !== null || input.metrics[key].raw);
  return hasMetrics || input.metricsSummary
    ? { capturedAt: input.capturedAt, metrics: input.metrics, rawSummary: input.metricsSummary }
    : null;
}

function parseAuthor(value: unknown): InspirationAuthor {
  const record = objectRecord(value);
  if (!record) return emptyAuthor();
  return {
    name: optionalString(record.name),
    platformAuthorId: optionalString(record.platformAuthorId ?? record.authorId),
    profileUrl: safeHttpUrl(record.profileUrl),
    followers: parseMetric(record.followers ?? record.followerCount),
  };
}

function mergeAuthor(current: InspirationAuthor, incoming: InspirationAuthor): InspirationAuthor {
  return {
    name: incoming.name ?? current.name,
    platformAuthorId: incoming.platformAuthorId ?? current.platformAuthorId,
    profileUrl: incoming.profileUrl ?? current.profileUrl,
    followers: incoming.followers.value !== null || incoming.followers.raw
      ? incoming.followers
      : current.followers,
  };
}

function normalizeUsage(value: unknown): InspirationUsage {
  const record = objectRecord(value);
  return {
    analysisStatus: record?.analysisStatus === "failed" ? "failed" : record?.analysisStatus === "pending" ? "pending" : "completed",
    contentProjectIds: stringArray(record?.contentProjectIds, 200),
    publicationIds: stringArray(record?.publicationIds, 200),
  };
}

function emptyMetrics(): InspirationMetrics {
  return {
    likes: nullMetric(),
    collects: nullMetric(),
    comments: nullMetric(),
    shares: nullMetric(),
    views: nullMetric(),
  };
}

function nullMetric(): InspirationMetric {
  return { value: null };
}

function emptyAuthor(): InspirationAuthor {
  return { followers: nullMetric() };
}

function emptyUsage(): InspirationUsage {
  return { analysisStatus: "completed", contentProjectIds: [], publicationIds: [] };
}

function extractPlatformContentId(platform: string, sourceUrl?: string) {
  if (!sourceUrl || !normalizeKey(platform).includes("小红书")) return undefined;
  try {
    return optionalString(new URL(sourceUrl).pathname.match(/\/(?:explore|discovery\/item)\/([^/?]+)/)?.[1]);
  } catch {
    return undefined;
  }
}

function parseCaptureMethod(value: unknown): InspirationCaptureMethod | undefined {
  return value === "manual" || value === "plugin" || value === "api" ? value : undefined;
}

function parseContentType(value: unknown): InspirationContentType {
  return value === "article" || value === "image" || value === "video" ? value : "unknown";
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown, label: string) {
  const normalized = optionalString(value);
  if (!normalized) throw new InspirationValidationError(`${label}不能为空`);
  return normalized;
}

function optionalString(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function stringArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
    : [];
}

function parseUrlArray(value: unknown, limit: number) {
  return stringArray(value, limit).flatMap((item) => safeHttpUrl(item) ? [item] : []);
}

function optionalHttpUrl(value: unknown, label: string) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const parsed = safeHttpUrl(normalized);
  if (!parsed) throw new InspirationValidationError(`${label}必须是 http 或 https 链接`);
  return parsed;
}

function safeHttpUrl(value: unknown) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function optionalIsoDate(value: unknown, label: string) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const parsed = safeIsoDate(normalized);
  if (!parsed) throw new InspirationValidationError(`${label}必须是有效时间`);
  return parsed;
}

function safeIsoDate(value: unknown) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
