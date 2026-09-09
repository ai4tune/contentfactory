// 市场搜索 API
// 支持小红书、抖音、公众号等平台
import { NextRequest, NextResponse } from "next/server";
import { createRedFoxProvider } from "@/modules/market/providers/redfox-provider";
import { rankMarketItems } from "@/modules/market/ranking";
import { upsertMarketItemToDb } from "@/lib/db";

// 创建 RedFox 提供者
function getRedFoxProvider() {
  const apiKey = process.env.REDFOX_API_KEY;
  if (!apiKey) {
    throw new Error("REDFOX_API_KEY 未配置");
  }
  return createRedFoxProvider({
    name: "redfox",
    apiKey,
    enabled: true,
    baseUrl: process.env.REDFOX_BASE_URL || (process.env.REDFOX_HOST ? `https://${process.env.REDFOX_HOST}` : undefined),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, keyword, page = 1, pageSize = 20 } = body;

    if (!["xiaohongshu", "douyin", "wechat", "channels"].includes(platform) || typeof keyword !== "string" || !keyword.trim() || keyword.length > 100
      || !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) {
      return NextResponse.json(
        { error: "请选择已支持的平台并填写关键词；页码从 1 开始，每页 1–20 条。" },
        { status: 400 }
      );
    }

    // 检查 RedFox API Key
    if (!process.env.REDFOX_API_KEY) {
      return NextResponse.json(
        {
          error: "未配置 RedFox API Key",
          hint: "请在 .env.local 文件中配置 REDFOX_API_KEY",
        },
        { status: 400 }
      );
    }

    const provider = getRedFoxProvider();

    // 搜索
    const items = await provider.searchWorks({
      platform,
      keyword,
      page,
      pageSize,
    });

    // 排名（Provider 已返回标准化 MarketItem，无需再次标准化）
    const rankedItems = rankMarketItems(items, {
      sortBy: "total",
      limit: pageSize,
    });

    // 保存到数据库
    try {
      for (const item of rankedItems) {
        item.id = upsertMarketItemToDb({
          id: item.id,
          provider: item.provider,
          providerItemId: item.providerItemId,
          platform: item.platform,
          platformContentId: item.platformContentId,
          canonicalUrl: item.canonicalUrl,
          sourceUrl: item.sourceUrl,
          title: item.title,
          summary: item.summary,
          body: item.body,
          contentType: item.contentType,
          authorId: item.author.id,
          authorName: item.author.name,
          authorFollowers: item.author.followers ?? undefined,
          authorProfileUrl: item.author.profileUrl,
          publishedAt: item.publishedAt,
          capturedAt: item.capturedAt,
          views: item.metrics.views ?? undefined,
          likes: item.metrics.likes ?? undefined,
          collects: item.metrics.collects ?? undefined,
          comments: item.metrics.comments ?? undefined,
          shares: item.metrics.shares ?? undefined,
          keywords: item.keywords,
          tags: item.tags,
          rawPayloadRef: item.rawPayloadRef,
          opportunityScore: item.opportunityScore?.total,
        });
      }
    } catch (dbError) {
      console.error("保存到数据库失败:", dbError);
      return NextResponse.json({ error: "搜索结果保存失败，请重试后再收藏。" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        items: rankedItems,
        totalCount: rankedItems.length,
        page,
        pageSize,
        expandedKeywords: [keyword],
      },
    });
  } catch (error) {
    console.error("市场搜索失败:", error);
    return NextResponse.json(
      {
        error: "市场搜索失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
