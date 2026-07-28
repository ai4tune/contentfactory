import { readStore } from "@/lib/store";
import type { ContentInspirationReference } from "@/modules/content/types";

export async function listInspirationReferences() {
  const store = await readStore();
  return [...store.inspirations].reverse().map(toInspirationReference);
}

export async function getInspirationReference(id: string) {
  if (!id) return null;
  const store = await readStore();
  const record = store.inspirations.find((item) => item.id === id);
  return record ? toInspirationReference(record) : null;
}

function toInspirationReference(
  record: Awaited<ReturnType<typeof readStore>>["inspirations"][number],
): ContentInspirationReference {
  return {
    id: record.id,
    platform: record.input.platform,
    title: record.input.title,
    sourceUrl: record.input.sourceUrl,
    metrics: record.input.metrics,
    summary: record.result.summary,
    targetAudience: record.result.targetAudience,
    painPoint: record.result.painPoint,
    hook: record.result.hook,
    structure: record.result.structure,
    reusablePatterns: record.result.reusablePatterns,
    adaptationIdeas: record.result.adaptationIdeas.length
      ? record.result.adaptationIdeas
      : record.result.topicCandidates,
    riskNotes: record.result.riskNotes,
  };
}
