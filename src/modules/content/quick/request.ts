import { normalizeKnowledgeSources } from "@/modules/content/server/request";
import { isContentChannel } from "@/modules/content/types";
import type { QuickCreationInput, QuickKnowledgeCandidate } from "./types";

const sourceTypes = new Set<QuickKnowledgeCandidate["sourceType"]>([
  "local",
  "feishu",
  "base",
  "upload",
]);

export function parseQuickKnowledgeRequest(value: unknown) {
  const record = asRecord(value);
  return {
    ...parsePlanReference(record),
    candidates: normalizeCandidates(record.candidates),
  };
}
export function parseQuickCreationRequest(value: unknown): QuickCreationInput {
  const record = asRecord(value);
  const reference = parsePlanReference(record);
  const sources = normalizeKnowledgeSources(record.sources);
  if (!sources.length) {
    throw new QuickRequestError("请至少确认一份企业资料后再生成。", 400);
  }
  if ("channel" in record && !isContentChannel(record.channel)) {
    throw new QuickRequestError("目标渠道无效。", 400);
  }
  return {
    ...reference,
    channel: isContentChannel(record.channel) ? record.channel : undefined,
    sources,
  };
}

export class QuickRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "QuickRequestError";
  }
}

function parsePlanReference(record: Record<string, unknown>) {
  const contentPlanId = String(record.contentPlanId ?? "").trim();
  const contentPlanItemId = String(record.contentPlanItemId ?? "").trim();
  if (!contentPlanId || !contentPlanItemId) {
    throw new QuickRequestError("快速创作必须指定内容计划和计划选题。", 400);
  }
  return { contentPlanId, contentPlanItemId };
}

function normalizeCandidates(value: unknown): QuickKnowledgeCandidate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const record = asRecord(item);
    const refId = String(record.refId ?? "").trim();
    const title = String(record.title ?? "").trim();
    const sourceType = String(record.sourceType ?? "") as QuickKnowledgeCandidate["sourceType"];
    const key = `${sourceType}:${refId}`;
    if (!refId || !title || !sourceTypes.has(sourceType) || seen.has(key)) return [];
    seen.add(key);
    return [{
      refId,
      title: title.slice(0, 300),
      sourceType,
      excerpt: optionalText(record.excerpt, 1_600),
      url: optionalText(record.url, 1_000),
      path: optionalText(record.path, 1_000),
    }];
  }).slice(0, 60);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalText(value: unknown, limit: number) {
  const text = String(value ?? "").trim().slice(0, limit);
  return text || undefined;
}
