// Idea 一键创建内容项目
import { NextRequest, NextResponse } from "next/server";
import { getIdeaFromDb } from "@/lib/db";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

    // 从 SQLite 获取 Idea
    const idea = getIdeaFromDb(id);
    if (!idea) {
      return NextResponse.json(
        { error: "未找到 Idea" },
        { status: 404 }
      );
    }

    // 打开编辑器不等于创建项目；状态由实际保存的内容项目推导。
    const createUrl = `/create?ideaId=${encodeURIComponent(id)}`;

    return NextResponse.json({
      success: true,
      data: {
        idea,
        createUrl,
      },
    });
  } catch (error) {
    console.error("创建内容项目失败:", error);
    return NextResponse.json(
      {
        error: "创建内容项目失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
