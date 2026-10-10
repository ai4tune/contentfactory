import { randomUUID } from "node:crypto";
import { dataFilePath } from "@/lib/data-directory";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { ChatError, isActiveTurn, type ChatStore, type ChatTurn, type ToolRecord } from "./types";
import type { ResearchRecord } from "@/modules/research/types";
import type { SendChatInput } from "./request";

const storePath = dataFilePath("agent-chat.local.json");
const empty: ChatStore = { conversations: [], memories: [], turns: [] };
export function readChatStore() { return readJsonFile(storePath, empty); }
export async function requireTurn(id: string) {
  const turn = (await readChatStore()).turns.find((item) => item.id === id);
  if (!turn) throw new ChatError("没有找到当前账号的对话任务。", 404);
  return turn;
}
export async function createTurn(input: SendChatInput) {
  const now = new Date().toISOString();
  const turnId = `turn_${randomUUID()}`, messageId = `message_${randomUUID()}`;
  const conversationId = input.conversationId ?? `chat_${randomUUID()}`;
  let created = false, result!: ChatTurn;
  await updateJsonFile(storePath, empty, (store) => {
    created = false;
    const existing = store.turns.find((item) => item.requestId === input.requestId);
    if (existing) {
      const message = store.conversations.find((item) => item.id === existing.conversationId)?.messages.find((item) => item.id === existing.messageId);
      if (message?.content !== input.content || JSON.stringify(message.sources ?? []) !== JSON.stringify(input.sources)
        || (input.conversationId && existing.conversationId !== input.conversationId)) throw new ChatError("这次请求已保存，请刷新后继续，或作为新的诉求发送。", 409);
      result = existing; return store;
    }
    if (store.turns.some(isActiveTurn)) throw new ChatError("已有任务正在执行，请等待完成或暂停后再发送。", 409);
    if (input.conversationId && !store.conversations.some((item) => item.id === input.conversationId)) throw new ChatError("没有找到当前账号的对话。", 404);
    const message = { id: messageId, role: "user" as const, content: input.content, createdAt: now, turnId, sources: input.sources };
    const conversations = input.conversationId
      ? store.conversations.map((item) => item.id === conversationId ? { ...item, updatedAt: now, messages: [...item.messages, message] } : item)
      : [...store.conversations, { id: conversationId, title: input.content.slice(0, 36), createdAt: now, updatedAt: now, messages: [message] }];
    result = { id: turnId, requestId: input.requestId, conversationId, messageId, attempt: 1,
      status: "queued", stage: "诉求已保存，等待处理", createdAt: now, updatedAt: now, tools: [], steps: 0 };
    created = true;
    return { ...store, conversations, turns: [...store.turns, result] };
  });
  return { turn: result, created };
}
export async function updateTurn(id: string, attempt: number, update: (turn: ChatTurn) => ChatTurn) {
  let result: ChatTurn | null = null;
  await updateJsonFile(storePath, empty, (store) => {
    result = null;
    return { ...store, turns: store.turns.map((turn) => {
      if (turn.id !== id || turn.attempt !== attempt) return turn;
      result = { ...update(turn), updatedAt: new Date().toISOString() };
      return result;
    }) };
  });
  return result as ChatTurn | null;
}
export async function assertTurnActive(id: string, attempt: number) {
  const turn = await requireTurn(id);
  if (turn.attempt !== attempt || !isActiveTurn(turn)) throw new ChatError("任务已暂停或在其他页面继续，已完成的结果仍保留。", 409);
  return turn;
}
export async function saveTool(id: string, attempt: number, record: ToolRecord) {
  return updateTurn(id, attempt, (turn) => {
    if (!isActiveTurn(turn)) throw new ChatError("任务已暂停，已完成结果仍保留。", 409);
    const current = turn.tools.find((item) => item.key === record.key);
    return { ...turn, tools: [...turn.tools.filter((item) => item.key !== record.key), { ...current, ...record }] };
  });
}
export async function finishTurn(id: string, attempt: number, content: string, status: "completed" | "waiting_user") {
  await updateJsonFile(storePath, empty, (store) => {
    const turn = store.turns.find((item) => item.id === id);
    if (!turn || turn.attempt !== attempt || !isActiveTurn(turn)) return store;
    const now = new Date().toISOString();
    const message = { id: `reply_${id}`, role: "assistant" as const, content, turnId: id, createdAt: now };
    return { ...store,
      turns: store.turns.map((item) => item.id === id ? { ...item, status, stage: status === "completed" ? "本次处理已完成" : "需要你补充或选择后继续", error: undefined, updatedAt: now } : item),
      conversations: store.conversations.map((item) => item.id === turn.conversationId ? {
        ...item, updatedAt: now, messages: [...item.messages.filter((current) => current.id !== message.id), message],
      } : item),
    };
  });
}
export async function resumeTurn(id: string) {
  const current = await requireTurn(id);
  let result: ChatTurn | null = null;
  await updateJsonFile(storePath, empty, (store) => {
    result = null;
    if (store.turns.some((item) => item.id !== id && isActiveTurn(item))) throw new ChatError("已有任务正在执行，请等待完成或先暂停。", 409);
    return { ...store, turns: store.turns.map((turn) => {
      if (turn.id !== id || turn.attempt !== current.attempt) return turn;
      if (turn.status === "completed" || turn.status === "waiting_user") throw new ChatError("请发送新的诉求继续这段对话。", 409);
      result = { ...turn, attempt: turn.attempt + 1, status: "queued", runId: undefined, error: undefined, stage: "继续处理，保留已完成结果", steps: 0 };
      return result;
    }) };
  });
  return result as ChatTurn | null;
}
export async function saveMemory(id: string, content: string, sourceMessageId: string) {
  await updateJsonFile(storePath, empty, (store) => {
    if (!store.conversations.some((item) => item.messages.some((message) => message.id === sourceMessageId && message.role === "user"))) throw new ChatError("只能记住当前账号自己说过的内容。", 404);
    const memories = store.memories.filter((item) => item.id !== id);
    if (content) memories.push({ id, content, sourceMessageId, updatedAt: new Date().toISOString() });
    if (memories.length > 30) throw new ChatError("已保存 30 条记忆，请先删去不再需要的内容。");
    return { ...store, memories };
  });
}

// This action is exposed only to the user-facing API, never as an AI tool.
export async function confirmResearchLocation(sourceId: string) {
  await updateJsonFile(storePath, empty, (store) => {
    if (store.turns.some(isActiveTurn)) throw new ChatError("请等待当前任务完成或暂停后，再确认调研地点。", 409);
    const source = store.turns.flatMap((turn) => turn.tools.filter((tool) => tool.status === "succeeded")
      .flatMap((tool) => (tool.output?.research as ResearchRecord | undefined)?.sources ?? []))
      .find((item) => item.id === sourceId && item.provider === "amap" && item.place);
    if (!source?.place) throw new ChatError("当前账号没有这个高德地点，请先查询并选择自己的地点来源。", 404);
    if (store.researchLocation?.sourceId === sourceId) return store;
    return { ...store, researchLocation: { sourceId, title: source.title, place: source.place, confirmedAt: new Date().toISOString() } };
  });
}
