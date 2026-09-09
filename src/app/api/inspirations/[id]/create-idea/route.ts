// Inspiration 一键创建 Idea
import { NextRequest, NextResponse } from "next/server";
import { getInspirationRecord } from "@/modules/inspirations/service";
import { saveIdeaToDb } from "@/lib/db";

function generateId(): string {
  return `idea_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

    // 获取 Inspiration
    const inspiration = await getInspirationRecord(id);
    if (!inspiration) {
      return NextResponse.json(
        { error: "未找到 Inspiration" },
        { status: 404 }
      );
    }

    const ideaId = generateId();

    // 保存到 SQLite
    saveIdeaToDb({
      id: ideaId,
      title: inspiration.content.title,
      summary: inspiration.analysis.summary || undefined,
      sourceUrl: inspiration.source.sourceUrl || inspiration.source.canonicalUrl,
      platform: inspiration.source.platform,
      status: "pool",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: ideaId,
        title: inspiration.content.title,
        status: "pool",
      },
    });
  } catch (error) {
    console.error("创建 Idea 失败:", error);
    return NextResponse.json(
      {
        error: "创建 Idea 失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
