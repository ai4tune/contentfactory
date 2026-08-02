import { readStore, updateStore } from "@/lib/store";
import type { InspirationResult } from "@/lib/ai";
import type { ContentInspirationReference } from "@/modules/content/types";
import {
  buildInspirationRecord,
  canonicalizeUrl,
  createInspirationDedupeKey,
  formatInspirationMetrics,
  mergeInspirationRecord,
  normalizePlatformIdentity,
} from "@/modules/inspirations/normalization";
import type {
  InspirationCaptureInput,
  InspirationFilters,
  InspirationRecord,
  InspirationUpsertResult,
} from "@/modules/inspirations/types";

export async function listInspirationRecords(filters: InspirationFilters = {}) {
  const store = await readStore();
  return [...store.inspirations]
    .filter((item) => matchesFilters(item, filters))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getInspirationRecord(id: string) {
  if (!id) return null;
  const store = await readStore();
  return store.inspirations.find((item) => item.id === id) ?? null;
}

export async function listInspirationReferences(filters: InspirationFilters = {}) {
  return (await listInspirationRecords(filters)).map(toInspirationReference);
}

export async function getInspirationReference(id: string) {
  const record = await getInspirationRecord(id);
  return record ? toInspirationReference(record) : null;
}

export async function upsertInspiration(
  input: InspirationCaptureInput,
  analysis: InspirationResult,
): Promise<InspirationUpsertResult> {
  const dedupeKey = createInspirationDedupeKey(input);
  let result: InspirationUpsertResult | null = null;

  await updateStore((store) => {
    const canonicalUrl = canonicalizeUrl(input.sourceUrl);
    const platform = normalizePlatformIdentity(input.platform);
    const existingIndex = store.inspirations.findIndex((item) => (
      item.dedupeKey === dedupeKey
      || (
        normalizePlatformIdentity(item.source.platform) === platform
        && Boolean(input.platformContentId)
        && item.source.platformContentId === input.platformContentId
      )
      || (
        normalizePlatformIdentity(item.source.platform) === platform
        && Boolean(canonicalUrl)
        && item.source.canonicalUrl === canonicalUrl
      )
    ));
    if (existingIndex === -1) {
      const record = buildInspirationRecord(input, analysis, createInspirationId());
      result = { operation: "created", record };
      return { ...store, inspirations: [...store.inspirations, record] };
    }

    const inspirations = [...store.inspirations];
    const record = mergeInspirationRecord(inspirations[existingIndex], input, analysis);
    inspirations[existingIndex] = record;
    result = { operation: "updated", record };
    return { ...store, inspirations };
  });

  if (!result) throw new Error("爆款保存失败");
  return result;
}

export function toInspirationReference(record: InspirationRecord): ContentInspirationReference {
  return {
    id: record.id,
    platform: record.source.platform,
    title: record.content.title,
    sourceUrl: record.source.sourceUrl ?? record.source.canonicalUrl,
    metrics: formatInspirationMetrics(record.metrics),
    summary: record.analysis.summary,
    targetAudience: record.analysis.targetAudience,
    painPoint: record.analysis.painPoint,
    hook: record.analysis.hook,
    structure: record.analysis.structure,
    reusablePatterns: record.analysis.reusablePatterns,
    adaptationIdeas: record.analysis.adaptationIdeas.length
      ? record.analysis.adaptationIdeas
      : record.analysis.topicCandidates,
    riskNotes: record.analysis.riskNotes,
  };
}

function matchesFilters(record: InspirationRecord, filters: InspirationFilters) {
  if (
    filters.platform
    && normalizePlatformIdentity(record.source.platform) !== normalizePlatformIdentity(filters.platform)
  ) return false;
  if (filters.sourceKeyword && record.discovery.sourceKeyword !== filters.sourceKeyword) return false;
  if (filters.usage === "used" && record.usage.contentProjectIds.length === 0) return false;
  if (filters.usage === "unused" && record.usage.contentProjectIds.length > 0) return false;
  return true;
}

function createInspirationId() {
  return `inspirations_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
