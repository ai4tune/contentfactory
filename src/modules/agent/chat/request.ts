import { z } from "zod";
import { ChatError } from "./types";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const source = z.object({
  id: z.string().min(1).max(300), title: z.string().trim().min(1).max(200),
  source: z.literal("local"), text: z.string().trim().min(1).max(12_000), path: z.string().max(500).optional(),
}).strict();
const sendSchema = z.object({
  requestId: id, conversationId: id.optional(), content: z.string().trim().min(1).max(4000),
  sources: z.array(source).max(2).default([]),
}).strict();
export function parseChatRequest(value: unknown) {
  const result = sendSchema.safeParse(value);
  if (!result.success || new Set(result.data.sources.map((item) => item.id)).size !== result.data.sources.length) {
    throw new ChatError("请填写 4000 字以内的诉求，最多选择两份各 12000 字以内的本地资料。");
  }
  return result.data;
}
export type SendChatInput = ReturnType<typeof parseChatRequest>;
export function parseMemoryRequest(value: unknown) {
  const result = z.object({ content: z.string().trim().max(500), sourceMessageId: id }).strict().safeParse(value);
  if (!result.success) throw new ChatError("记忆最多 500 字，请指定当前账号的用户消息。");
  return result.data;
}
