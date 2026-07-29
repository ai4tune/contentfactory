import type {
  BriefKnowledgeSource,
  ContentBrief,
  ContentInspirationReference,
} from "../types";
import { normalizeBriefList } from "./normalize-brief-list";

const sourceTypes = new Set<BriefKnowledgeSource["source"]>([
  "local",
  "feishu",
  "base",
  "upload",
]);

export function normalizeKnowledgeSources(value: unknown): BriefKnowledgeSource[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const title = String(record.title ?? "").trim();
    const text = String(record.text ?? "").trim().slice(0, 12_000);
    const source = String(record.source ?? "") as BriefKnowledgeSource["source"];
    if (!id || !title || !text || !sourceTypes.has(source)) return [];

    return [{
      id,
      title,
      text,
      source,
      url: optionalString(record.url),
      path: optionalString(record.path),
    }];
  }).slice(0, 12);
}

export function normalizeContentBrief(value: unknown): ContentBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const citations = Array.isArray(record.citations)
    ? record.citations.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const citation = item as Record<string, unknown>;
        const sourceId = String(citation.sourceId ?? "").trim();
        const sourceTitle = String(citation.sourceTitle ?? "").trim();
        const sourceType = String(citation.sourceType ?? "") as BriefKnowledgeSource["source"];
        const excerpt = String(citation.excerpt ?? "").trim();
        const purpose = String(citation.purpose ?? "").trim();
        if (!sourceId || !sourceTitle || !sourceTypes.has(sourceType) || !excerpt || !purpose) return [];
        return [{
          sourceId,
          sourceTitle,
          sourceType,
          excerpt,
          purpose,
          url: optionalString(citation.url),
          path: optionalString(citation.path),
        }];
      })
    : [];
  const brief: ContentBrief = {
    targetAudience: String(record.targetAudience ?? "").trim(),
    contentGoal: String(record.contentGoal ?? "").trim(),
    coreMessage: String(record.coreMessage ?? "").trim(),
    keyPoints: normalizeBriefList(record.keyPoints),
    outline: normalizeBriefList(record.outline),
    callToAction: String(record.callToAction ?? "").trim(),
    citations,
    openQuestions: normalizeBriefList(record.openQuestions),
    inspiration: normalizeInspirationReference(record.inspiration),
  };

  return brief.targetAudience
    && brief.contentGoal
    && brief.coreMessage
    && brief.outline.length
    && (citations.length || brief.inspiration)
    ? brief
    : null;
}

function normalizeInspirationReference(value: unknown): ContentInspirationReference | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = String(record.id ?? "").trim();
  const platform = String(record.platform ?? "").trim();
  const title = String(record.title ?? "").trim();
  const summary = String(record.summary ?? "").trim();
  if (!id || !platform || !title || !summary) return undefined;

  return {
    id,
    platform,
    title,
    sourceUrl: optionalString(record.sourceUrl),
    metrics: optionalString(record.metrics),
    summary,
    targetAudience: String(record.targetAudience ?? "").trim(),
    painPoint: String(record.painPoint ?? "").trim(),
    hook: String(record.hook ?? "").trim(),
    structure: normalizeBriefList(record.structure),
    reusablePatterns: normalizeBriefList(record.reusablePatterns),
    adaptationIdeas: normalizeBriefList(record.adaptationIdeas),
    riskNotes: normalizeBriefList(record.riskNotes),
  };
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}
