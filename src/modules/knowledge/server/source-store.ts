import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { RemoteKnowledgeSource } from "../types";

const sourceStorePath = path.join(process.cwd(), "data", "knowledge-sources.local.json");
const emptySourceStore = { sources: [] as RemoteKnowledgeSource[] };

export async function listRemoteKnowledgeSources() {
  const store = await readJsonFile(sourceStorePath, emptySourceStore);
  return store.sources ?? [];
}

export async function saveRemoteKnowledgeSource(
  source: Omit<RemoteKnowledgeSource, "updatedAt">,
) {
  const record: RemoteKnowledgeSource = {
    ...source,
    updatedAt: new Date().toISOString(),
  };
  await updateJsonFile(sourceStorePath, emptySourceStore, (store) => {
    const sources = [...(store.sources ?? [])];
    const existingIndex = sources.findIndex(
      (item) => item.id === record.id && item.source === record.source,
    );

    if (existingIndex >= 0) sources[existingIndex] = record;
    else sources.push(record);

    return { sources };
  });
  return record;
}
