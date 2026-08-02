import type { InspirationResult } from "@/lib/ai";

export const inspirationSchemaVersion = 2 as const;

export type InspirationCaptureMethod = "manual" | "plugin";
export type InspirationContentType = "article" | "image" | "video" | "unknown";
export type InspirationAnalysisStatus = "completed" | "failed";

export type InspirationMetric = {
  value: number | null;
  raw?: string;
};

export type InspirationMetrics = {
  likes: InspirationMetric;
  collects: InspirationMetric;
  comments: InspirationMetric;
  shares: InspirationMetric;
  views: InspirationMetric;
};

export type InspirationMetricSnapshot = {
  capturedAt: string;
  metrics: InspirationMetrics;
  rawSummary?: string;
};

export type InspirationSource = {
  platform: string;
  platformContentId?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  captureMethod: InspirationCaptureMethod;
};

export type InspirationContent = {
  title: string;
  body: string;
  contentType: InspirationContentType;
  tags: string[];
  imageUrls: string[];
  coverUrl?: string;
  publishedAt?: string;
};

export type InspirationAuthor = {
  name?: string;
  platformAuthorId?: string;
  profileUrl?: string;
  followers: InspirationMetric;
};

export type InspirationDiscovery = {
  sourceKeyword?: string;
  contentDirection?: string;
  searchTaskId?: string;
};

export type InspirationUsage = {
  analysisStatus: InspirationAnalysisStatus;
  contentProjectIds: string[];
  publicationIds: string[];
};

export type InspirationRecord = {
  schemaVersion: typeof inspirationSchemaVersion;
  id: string;
  createdAt: string;
  updatedAt: string;
  firstCapturedAt: string;
  lastCapturedAt: string;
  dedupeKey: string;
  source: InspirationSource;
  content: InspirationContent;
  author: InspirationAuthor;
  discovery: InspirationDiscovery;
  metrics: InspirationMetrics;
  metricSnapshots: InspirationMetricSnapshot[];
  analysis: InspirationResult;
  usage: InspirationUsage;
};

export type InspirationCaptureInput = {
  platform: string;
  sourceUrl?: string;
  platformContentId?: string;
  captureMethod: InspirationCaptureMethod;
  title: string;
  content: string;
  contentType: InspirationContentType;
  tags: string[];
  imageUrls: string[];
  coverUrl?: string;
  author: InspirationAuthor;
  publishedAt?: string;
  capturedAt: string;
  sourceKeyword?: string;
  contentDirection?: string;
  searchTaskId?: string;
  accountPosition?: string;
  metrics: InspirationMetrics;
  metricsSummary?: string;
};

export type InspirationFilters = {
  platform?: string;
  sourceKeyword?: string;
  usage?: "used" | "unused";
};

export type InspirationUpsertResult = {
  operation: "created" | "updated";
  record: InspirationRecord;
};
