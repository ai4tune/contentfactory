import { readChatStore } from "@/modules/agent/chat/repository";
import { ChatError } from "@/modules/agent/chat/types";
import type { ResearchRecord } from "./types";

// The authenticated chat store owns research snapshots; no second account store or migration.
export async function listResearch(): Promise<ResearchRecord[]> {
  const records = (await readChatStore()).turns.flatMap((turn) => turn.tools
    .filter((tool) => tool.status === "succeeded" && tool.output?.research)
    .map((tool) => tool.output!.research as ResearchRecord));
  return [...new Map(records.map((record) => [record.id, record])).values()]
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
}
export async function readResearch(id: string) {
  const record = (await listResearch()).find((item) => item.id === id);
  if (!record) throw new ChatError("当前账号没有这份调研记录。", 404);
  return researchForModel(record);
}
export async function selectedResearchSources(ids: string[]) {
  const records = await listResearch();
  if (ids.some((id) => records.some((record) => record.id === id))) throw new ChatError("传入的是整次调研编号，请先读取这次调研，并选择其中具体来源的编号。", 400);
  const sources = records.flatMap((record) => record.sources);
  if (ids.some((id) => !sources.some((source) => source.id === id))) throw new ChatError("同行参考不属于当前账号，请先读取自己的调研记录。", 404);
  return sources.filter((source) => ids.includes(source.id));
}

// Keep the original UTC timestamp, and provide an explicit display time for the model.
export function researchForModel(record: ResearchRecord) {
  return { ...record, retrievedAtBeijing: `${new Date(record.retrievedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）` };
}
