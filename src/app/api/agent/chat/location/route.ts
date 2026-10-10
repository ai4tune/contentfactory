import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmResearchLocation } from "@/modules/agent/chat/repository";
import { ChatError } from "@/modules/agent/chat/types";

export async function POST(request: Request) {
  try {
    const input = z.object({ sourceId: z.string().trim().min(1).max(300) }).strict().safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ChatError("请选择查询结果中的地点，不能直接提交坐标。");
    await confirmResearchLocation(input.data.sourceId);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof ChatError ? error.message : "地点尚未确认，请稍后重试。" }, { status: error instanceof ChatError ? error.status : 503 }); }
}
