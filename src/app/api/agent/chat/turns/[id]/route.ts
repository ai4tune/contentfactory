import { NextResponse } from "next/server";
import { continueChatTurn, pauseChatTurn } from "@/modules/agent/chat/runtime";
import { ChatError } from "@/modules/agent/chat/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (body?.action !== "continue" && body?.action !== "pause") throw new ChatError("请选择暂停或继续处理。");
    const turn = body.action === "pause" ? await pauseChatTurn(id) : await continueChatTurn(id);
    return NextResponse.json({ turn });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "任务未更新，请重试。" }, { status: error instanceof ChatError ? error.status : 503 }); }
}
