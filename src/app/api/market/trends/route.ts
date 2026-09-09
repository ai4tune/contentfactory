import { chinaToday, dateOffset, marketError, redfoxProvider } from "@/modules/market/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.keyword !== "string" || !body.keyword.trim() || body.keyword.length > 100
    || ![3, 7, 14].includes(body.days) || !["douyin", "kuaishou", "weibo", "baidu", "bilibili", "zhihu", "toutiao"].includes(body.platform)) {
    return Response.json({ error: "请输入关键词，选择热搜平台及 3、7 或 14 天窗口。" }, { status: 400 });
  }
  try {
    const end = chinaToday(); // 仅对比完整自然日，避免今天未结束造成偏差。
    const middle = dateOffset(end, -body.days), start = dateOffset(middle, -body.days);
    const provider = redfoxProvider();
    const [current, previous] = await Promise.all([
      provider.getHotspots({ platform: body.platform, keyword: body.keyword, startDate: middle, endDate: end }),
      provider.getHotspots({ platform: body.platform, keyword: body.keyword, startDate: start, endDate: middle }),
    ]);
    const average = (items: typeof current) => {
      const values = items.flatMap(item => item.heat === null ? [] : [item.heat]);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    const currentAverage = average(current), previousAverage = average(previous);
    const growth = currentAverage !== null && previousAverage !== null && previousAverage > 0 ? (currentAverage - previousAverage) / previousAverage : null;
    return Response.json({ current, previous, currentAverage, previousAverage, growth,
      windows: { start, middle, end },
      note: "仅对比同平台两期返回的热搜样本平均热度，不代表全网内容量、播放量或账号增长；样本受榜单截断影响，缺少基期不计算增长率。" });
  } catch (error) { return marketError(error); }
}
