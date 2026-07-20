import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RemoteKnowledgeSource } from "../types";

const sourceStorePath = path.join(process.cwd(), "data", "knowledge-sources.local.json");

export async function listRemoteKnowledgeSources() {
  try {
    const content = await readFile(sourceStorePath, "utf8");
    const parsed = JSON.parse(content) as { sources?: RemoteKnowledgeSource[] };
    return parsed.sources ?? [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function saveRemoteKnowledgeSource(
  source: Omit<RemoteKnowledgeSource, "updatedAt">,
) {
  const sources = await listRemoteKnowledgeSources();
  const record: RemoteKnowledgeSource = {
    ...source,
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = sources.findIndex(
    (item) => item.id === record.id && item.source === record.source,
  );

  if (existingIndex >= 0) {
    sources[existingIndex] = record;
  } else {
    sources.push(record);
  }

  await mkdir(path.dirname(sourceStorePath), { recursive: true });
  await writeFile(sourceStorePath, `${JSON.stringify({ sources }, null, 2)}\n`, "utf8");
  return record;
}
