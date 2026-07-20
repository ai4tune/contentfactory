import type { BriefKnowledgeSource, ContentBrief } from "../types";

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
    keyPoints: toStrings(record.keyPoints),
    outline: toStrings(record.outline),
    callToAction: String(record.callToAction ?? "").trim(),
    citations,
    openQuestions: toStrings(record.openQuestions),
  };

  return brief.targetAudience && brief.contentGoal && brief.coreMessage && brief.outline.length && citations.length
    ? brief
    : null;
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function toStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
