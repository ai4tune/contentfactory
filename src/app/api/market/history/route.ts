import { readMarketHistory } from "@/modules/market/history";
import { publicMarketItem } from "@/modules/market/server";
export async function GET() {
  try {
    const records = (await readMarketHistory()).map(record => ({
      ...record,
      items: record.items.map(publicMarketItem),
    }));
    return Response.json({ records });
  }
  catch { return Response.json({ error: "搜索历史读取失败，请重试。" }, { status: 500 }); }
}
