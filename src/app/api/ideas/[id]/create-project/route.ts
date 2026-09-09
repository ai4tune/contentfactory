// Idea 一键创建内容项目
import { NextRequest, NextResponse } from "next/server";
import { getIdeaFromDb, updateIdeaStatus } from "@/lib/db";

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

    // 更新 Idea 状态
    updateIdeaStatus(id, "creating");

    // 生成创建链接，携带选题信息
    const createUrl = `/create?ideaId=${id}&title=${encodeURIComponent(String(idea.title))}${idea.source_url ? `&sourceUrl=${encodeURIComponent(String(idea.source_url))}` : ""}`;

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
