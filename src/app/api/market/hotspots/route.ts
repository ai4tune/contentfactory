import { chinaToday, dateOnly, dateOffset, marketError, redfoxProvider } from "@/modules/market/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !dateOnly(body.startDate) || !dateOnly(body.endDate) || body.startDate >= body.endDate
    || body.endDate > dateOffset(chinaToday(), 1) || body.startDate < dateOffset(chinaToday(), -30)
    || Date.parse(body.endDate) - Date.parse(body.startDate) > 30 * 86400000
    || (body.keyword !== undefined && (typeof body.keyword !== "string" || body.keyword.length > 100))
    || (body.platform && !["douyin", "kuaishou", "weibo", "baidu", "bilibili", "zhihu", "toutiao"].includes(body.platform))) {
    return Response.json({ error: "热搜需选择支持的平台及不超过 30 天的日期区间，结束日期不含当天。" }, { status: 400 });
  }
  try { return Response.json({ items: await redfoxProvider().getHotspots(body) }); }
  catch (error) { return marketError(error); }
}
