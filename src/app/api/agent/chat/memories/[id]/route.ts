import { NextResponse } from "next/server";
import { saveMemory } from "@/modules/agent/chat/repository";
import { parseMemoryRequest } from "@/modules/agent/chat/request";
import { ChatError } from "@/modules/agent/chat/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ChatError("记忆标识无效。");
    const input = parseMemoryRequest(await request.json().catch(() => null));
    await saveMemory(id, input.content, input.sourceMessageId);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "记忆未保存，请重试。" }, { status: error instanceof ChatError ? error.status : 503 }); }
}
