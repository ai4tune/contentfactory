// 市场搜索 API
// 支持小红书、抖音、公众号等平台
import { NextRequest, NextResponse } from "next/server";
import { rankMarketItems } from "@/modules/market/ranking";
import { saveMarketHistory } from "@/modules/market/history";
import { marketError, marketProvider, persistMarketItems } from "@/modules/market/server";

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

    // 检查市场数据服务配置
    if (!process.env.REDFOX_API_KEY) {
      return NextResponse.json(
        {
          error: "市场数据服务尚未配置",
          hint: "请联系管理员完成市场数据服务配置。",
        },
        { status: 400 }
      );
    }

    const provider = marketProvider();

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
    let publicItems;
    try {
      publicItems = persistMarketItems(rankedItems);
    } catch (dbError) {
      console.error("保存到数据库失败:", dbError);
      return NextResponse.json({ error: "搜索结果保存失败，请重试后再收藏。" }, { status: 500 });
    }

    const history = await saveMarketHistory("search", { platform, keyword, page }, publicItems);
    return NextResponse.json({
      success: true,
      data: {
        historyId: history.id,
        items: publicItems,
        totalCount: publicItems.length,
        page,
        pageSize,
        expandedKeywords: [keyword],
      },
    });
  } catch (error) {
    console.error("市场搜索失败:", error);
    return marketError(error);
  }
}
