// MarketItem 一键保存为 Inspiration
import { NextRequest, NextResponse } from "next/server";
import { getMarketItemFromDb } from "@/lib/db";
import { upsertInspiration, listInspirationRecords } from "@/modules/inspirations/service";
import { canonicalizeUrl, normalizePlatformIdentity } from "@/modules/inspirations/normalization";
import type { InspirationCaptureInput } from "@/modules/inspirations/types";
import { findSavedMarketItem } from "@/modules/market/history";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const item = getMarketItemFromDb(id);
  if (!item) return Response.json({ id: null });
  const url = canonicalizeUrl(String(item.source_url || item.canonical_url || ""));
  const record = (await listInspirationRecords()).find(row => normalizePlatformIdentity(row.source.platform) === normalizePlatformIdentity(String(item.platform)) &&
    ((item.platform_content_id && row.source.platformContentId === item.platform_content_id) || (url && row.source.canonicalUrl === url)));
  return Response.json({ id: record?.id || null });
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

    // 获取市场项目
    const marketItem = getMarketItemFromDb(id);
    if (!marketItem) {
      return NextResponse.json(
        { error: "未找到市场项目" },
        { status: 404 }
      );
    }

    const snapshot = await findSavedMarketItem(id);
    // 转换为 InspirationCaptureInput
    const inspirationInput: InspirationCaptureInput = {
      platform: marketItem.platform as string,
      sourceUrl: ((marketItem.source_url || marketItem.canonical_url) as string) || "",
      captureMethod: "api",
      platformContentId: (marketItem.platform_content_id as string) || undefined,
      title: marketItem.title as string,
      content: (marketItem.body as string) || "",
      contentType: (marketItem.content_type as "article" | "image" | "video" | "unknown") || "article",
      tags: marketItem.tags ? JSON.parse(marketItem.tags as string) : [],
      imageUrls: snapshot?.coverUrl ? [snapshot.coverUrl] : [],
      coverUrl: snapshot?.coverUrl,
      author: {
        name: (marketItem.author_name as string) || "",
        followers: { value: (marketItem.author_followers as number) ?? null },
      },
      metrics: {
        views: { value: (marketItem.views as number) ?? null },
        likes: { value: (marketItem.likes as number) ?? null },
        collects: { value: (marketItem.collects as number) ?? null },
        comments: { value: (marketItem.comments as number) ?? null },
        shares: { value: (marketItem.shares as number) ?? null },
      },
      publishedAt: marketItem.published_at as string,
      capturedAt: marketItem.captured_at as string,
      sourceKeyword: marketItem.keywords
        ? JSON.parse(marketItem.keywords as string)[0]
        : undefined,
    };

    // 保存为 Inspiration
    const result = await upsertInspiration(inspirationInput, {
      summary: (marketItem.summary as string) || "",
      targetAudience: "",
      painPoint: "",
      hook: "",
      pacing: "",
      evidence: [],
      callToAction: "",
      structure: [],
      reusablePatterns: [],
      keywords: [],
      adaptationIdeas: [],
      topicCandidates: [],
      riskNotes: [],
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("保存为 Inspiration 失败:", error);
    return NextResponse.json(
      {
        error: "保存为 Inspiration 失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
