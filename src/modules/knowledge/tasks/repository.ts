import { randomUUID } from "node:crypto";
import { dataFilePath } from "@/lib/data-directory";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { splitKnowledgeBatches } from "@/modules/knowledge-profile/service";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import { isKnowledgeTaskActive, type KnowledgeTaskKind, type StoredKnowledgeTask } from "./types";

type Store = { tasks: StoredKnowledgeTask[] };
const storePath = dataFilePath("knowledge-tasks.local.json");
const emptyStore: Store = { tasks: [] };

export async function listKnowledgeTasks() {
  return (await readJsonFile<Store>(storePath, emptyStore)).tasks;
}

export async function getKnowledgeTask(id: string) {
  return (await listKnowledgeTasks()).find((task) => task.id === id) ?? null;
}

export async function createKnowledgeTask(kind: KnowledgeTaskKind, sources: BriefKnowledgeSource[]) {
  let result!: StoredKnowledgeTask;
  let created = false;
  await updateJsonFile<Store>(storePath, emptyStore, (store) => {
    created = false;
    const active = store.tasks.find(isKnowledgeTaskActive);
    if (active) { result = active; return store; }
    const totalBatches = splitKnowledgeBatches(sources).length;
    const rounds = Math.ceil(totalBatches / 2) + (kind === "profile" && totalBatches > 1 ? 1 : 0);
    const now = new Date().toISOString();
    result = {
      id: `knowledgeTask_${randomUUID()}`, kind, status: "queued", attempt: 1,
      sourceCount: sources.length, completedBatches: 0, totalBatches,
      stage: "已提交，等待后台处理", estimatedMinutes: { min: rounds, max: rounds * 3 },
      createdAt: now, updatedAt: now, sources, batches: {},
    };
    created = true;
    // Failed inputs are kept for a day to resume; completed jobs contain no source text.
    const recent = store.tasks.slice(0, 19).map((task) =>
      Date.now() - Date.parse(task.updatedAt) > 86_400_000
        ? { ...task, sources: undefined, batches: {}, compiledProfile: undefined }
        : task);
    return { tasks: [result, ...recent] };
  });
  return { task: result, created };
}

export async function updateKnowledgeTask(
  id: string, attempt: number, change: (task: StoredKnowledgeTask) => StoredKnowledgeTask,
) {
  let result: StoredKnowledgeTask | null = null;
  await updateJsonFile<Store>(storePath, emptyStore, (store) => {
    result = null;
    return { tasks: store.tasks.map((task) => {
      if (task.id !== id || task.attempt !== attempt) return task;
      result = { ...change(task), updatedAt: new Date().toISOString() };
      return result;
    }) };
  });
  return result as StoredKnowledgeTask | null;
}

export async function retryKnowledgeTask(id: string) {
  let result: StoredKnowledgeTask | null = null;
  await updateJsonFile<Store>(storePath, emptyStore, (store) => {
    result = null;
    if (store.tasks.some(isKnowledgeTaskActive)) throw new Error("已有任务正在处理，请等待完成。");
    return { tasks: store.tasks.map((task) => {
      if (task.id !== id) return task;
      if (task.status !== "failed" || !task.sources || Date.now() - Date.parse(task.updatedAt) > 86_400_000) {
        throw new Error("该任务无法继续，请重新选择资料提交。");
      }
      result = {
        ...task, attempt: task.attempt + 1, runId: undefined, status: "queued",
        stage: "已提交重试，保留已完成的批次", error: undefined, finishedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      return result;
    }) };
  });
  return result as StoredKnowledgeTask | null;
}
