import { readMarketHistory } from "@/modules/market/history";
export async function GET() {
  try { return Response.json({ records: await readMarketHistory() }); }
  catch { return Response.json({ error: "搜索历史读取失败，请重试。" }, { status: 500 }); }
}
