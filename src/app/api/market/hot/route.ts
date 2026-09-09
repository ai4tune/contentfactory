import { chinaToday, dateOnly, dateOffset, marketError, persistMarketItems, redfoxProvider } from "@/modules/market/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !["xiaohongshu", "douyin", "wechat"].includes(body.platform) || !dateOnly(body.date)
    || body.date > chinaToday() || body.date < dateOffset(chinaToday(), -30)
    || (body.category !== undefined && (typeof body.category !== "string" || body.category.length > 100))) {
    return Response.json({ error: "请选择支持的平台及最近 30 天内的榜单日期。" }, { status: 400 });
  }
  try {
    const items = persistMarketItems(await redfoxProvider().getTrending(body));
    return Response.json({ items, date: body.date, note: "保留数据源榜单顺序；非实时数据，缺失指标显示为未知。小红书 w+ 指标为近似下界。" });
  } catch (error) { return marketError(error); }
}
