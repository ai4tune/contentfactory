import { chinaToday, dateOffset, dateOnly, marketError, redfoxProvider } from "@/modules/market/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !dateOnly(body.date) || body.date > chinaToday() || body.date < dateOffset(chinaToday(), -29)) {
    return Response.json({ error: "请选择最近 30 天内的热点日期。" }, { status: 400 });
  }
  try { return Response.json({ items: await redfoxProvider().getHotKeywords({ startDate: body.date, endDate: dateOffset(body.date, 1) }) }); }
  catch (error) { return marketError(error); }
}
