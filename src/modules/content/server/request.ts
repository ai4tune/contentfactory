import type {
  BriefKnowledgeSource,
  ContentBrief,
  ContentInspirationPlan,
  ContentInspirationPlanItem,
  ContentInspirationReference,
  InspirationPlanDecision,
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
  const inspiration = normalizeInspirationReference(record.inspiration);
  const inspirationPlan = inspiration
    ? normalizeInspirationPlan(record.inspirationPlan, inspiration)
    : undefined;
  const brief: ContentBrief = {
    targetAudience: String(record.targetAudience ?? "").trim(),
    contentGoal: String(record.contentGoal ?? "").trim(),
    coreMessage: String(record.coreMessage ?? "").trim(),
    keyPoints: normalizeBriefList(record.keyPoints),
    outline: inspirationPlan
      ? outlineFromInspirationPlan(inspirationPlan)
      : normalizeBriefList(record.outline),
    callToAction: String(record.callToAction ?? "").trim(),
    citations,
    openQuestions: normalizeBriefList(record.openQuestions),
    inspiration,
    inspirationPlan,
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
    pacing: String(record.pacing ?? "").trim(),
    structure: normalizeBriefList(record.structure),
    reusablePatterns: normalizeBriefList(record.reusablePatterns),
    adaptationIdeas: normalizeBriefList(record.adaptationIdeas),
    riskNotes: normalizeBriefList(record.riskNotes),
  };
}

export function normalizeInspirationPlan(
  value: unknown,
  inspiration: ContentInspirationReference,
): ContentInspirationPlan {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const provided = rawItems.flatMap(normalizeInspirationPlanItem);
  const expected = expectedPlanItems(inspiration);
  const items = expected.map((item) => {
    const match = provided.find((candidate) => (
      candidate.kind === item.kind
      && candidate.sourceIndex === item.sourceIndex
    ));
    return match ? { ...match, sourceElement: item.sourceElement } : fallbackPlanItem(item);
  });
  const hasPlannedSection = items.some((item) => item.kind === "section" && item.decision !== "discard");
  if (!hasPlannedSection) {
    const firstSection = items.findIndex((item) => item.kind === "section");
    if (firstSection >= 0) items[firstSection] = fallbackPlanItem(items[firstSection]);
  }

  return {
    items,
    boundaries: [...new Set([
      ...normalizeBriefList(record.boundaries),
      ...defaultInspirationBoundaries(),
    ])],
  };
}

export function outlineFromInspirationPlan(plan: ContentInspirationPlan): string[] {
  return plan.items
    .filter((item) => item.kind !== "pacing" && item.decision !== "discard")
    .map((item) => item.plannedUse)
    .filter(Boolean);
}

function normalizeInspirationPlanItem(value: unknown): ContentInspirationPlanItem[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const kind = String(record.kind ?? "");
  const decision = String(record.decision ?? "");
  const sourceIndex = Number(record.sourceIndex);
  const sourceElement = String(record.sourceElement ?? "").trim();
  const plannedUse = String(record.plannedUse ?? "").trim();
  const rationale = String(record.rationale ?? "").trim();
  if (!isPlanKind(kind) || !isPlanDecision(decision) || !Number.isInteger(sourceIndex) || sourceIndex < 0) return [];
  if (!sourceElement || !rationale || (decision !== "discard" && !plannedUse)) return [];
  return [{ kind, sourceIndex, sourceElement, decision, plannedUse: decision === "discard" ? "" : plannedUse, rationale }];
}

function expectedPlanItems(inspiration: ContentInspirationReference): ContentInspirationPlanItem[] {
  return [
    ...(inspiration.hook ? [{ kind: "hook" as const, sourceIndex: 0, sourceElement: inspiration.hook }] : []),
    ...inspiration.structure.map((sourceElement, sourceIndex) => ({ kind: "section" as const, sourceIndex, sourceElement })),
    ...(inspiration.pacing ? [{ kind: "pacing" as const, sourceIndex: 0, sourceElement: inspiration.pacing }] : []),
  ].map(fallbackPlanItem);
}

function fallbackPlanItem(item: Pick<ContentInspirationPlanItem, "kind" | "sourceIndex" | "sourceElement">): ContentInspirationPlanItem {
  const labels = { hook: "开头", section: "正文", pacing: "整体节奏" };
  return {
    ...item,
    decision: "adapt",
    plannedUse: item.kind === "pacing" ? `借鉴该节奏组织全文：${item.sourceElement}` : `${labels[item.kind]}改写：${item.sourceElement}`,
    rationale: "保留有效机制，但结合当前账号定位、选题和知识证据重新表达。",
  };
}

function defaultInspirationBoundaries() {
  return [
    "不得照抄参考原句。",
    "不得继承参考中的事实、案例、数据、产品承诺或用户证言。",
    "所有事实只使用本次知识资料中可追溯的证据；缺少证据时标记待确认。",
  ];
}

function isPlanKind(value: string): value is ContentInspirationPlanItem["kind"] {
  return value === "hook" || value === "section" || value === "pacing";
}

function isPlanDecision(value: string): value is InspirationPlanDecision {
  return value === "adopt" || value === "adapt" || value === "discard";
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}
