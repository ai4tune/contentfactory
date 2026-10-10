import { NextResponse } from "next/server";
import { createTurn, readChatStore } from "@/modules/agent/chat/repository";
import { parseChatRequest } from "@/modules/agent/chat/request";
import { isTurnInterrupted, launchChatTurn } from "@/modules/agent/chat/runtime";
import { ChatError } from "@/modules/agent/chat/types";
import { getDataWorkspaceId } from "@/lib/data-workspace";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const state = await readChatStore();
    const turns = await Promise.all(state.turns.map(async (turn) => {
      const interrupted = await isTurnInterrupted(turn).catch(() => false);
      return interrupted ? { ...turn, status: "failed" as const, stage: "后台任务已中断，进度仍保留", error: "请点击继续处理。" } : turn;
    }));
    return NextResponse.json({ ...state, turns, workspaceId: await getDataWorkspaceId() ?? "local" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "暂时无法读取当前账号的对话，请稍后刷新。" }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const { turn, created } = await createTurn(parseChatRequest(await request.json().catch(() => null)));
    if (created) await launchChatTurn(turn);
    return NextResponse.json({ turn }, { status: created ? 202 : 200 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "诉求尚未提交，请重试。" }, { status: error instanceof ChatError ? error.status : 503 }); }
}
