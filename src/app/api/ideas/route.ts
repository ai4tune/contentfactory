// 选题 API
import { NextRequest, NextResponse } from "next/server";
import { saveIdeaToDb } from "@/lib/db";
import { listIdeas } from "@/modules/ideas/service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const ideas = await listIdeas(status);
    return NextResponse.json({ success: true, data: ideas });
  } catch (error) {
    console.error("获取选题列表失败:", error);
    return NextResponse.json(
      { error: "获取选题列表失败", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, sourceUrl, platform, marketItemId } = body;

    if (!title) {
      return NextResponse.json({ error: "缺少必要参数: title" }, { status: 400 });
    }

    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    saveIdeaToDb({
      id,
      title: title.trim(),
      summary: summary?.trim(),
      sourceUrl,
      platform,
      marketItemId,
      status: "pool",
    });

    return NextResponse.json({
      success: true,
      data: { id, title, status: "pool" },
    });
  } catch (error) {
    console.error("创建选题失败:", error);
    return NextResponse.json(
      { error: "创建选题失败", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
