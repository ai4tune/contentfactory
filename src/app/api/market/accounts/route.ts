import { listTrackedAccountBundles, saveTrackedAccountBundle } from "@/lib/db";
import { marketError, marketProvider, persistMarketItems, publicMarketAccount, publicTrackedAccountBundle } from "@/modules/market/server";

export async function GET() { return Response.json({ accounts: (await listTrackedAccountBundles()).map(publicTrackedAccountBundle) }); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !["xiaohongshu", "douyin", "wechat"].includes(body.platform) || typeof body.accountId !== "string"
    || !body.accountId.trim() || body.accountId.length > 200 || /[\s/?#]/.test(body.accountId)) {
    return Response.json({ error: "请选择小红书、抖音或公众号，并输入平台展示的账号 ID（非昵称或链接）。" }, { status: 400 });
  }
  try {
    const provider = marketProvider();
    const account = publicMarketAccount(await provider.getAccount(body));
    const items = await persistMarketItems(await provider.getAccountWorks({ platform: account.platform, accountId: account.platformAccountId! }));
    const bundle = { account, items };
    await saveTrackedAccountBundle(bundle);
    return Response.json(bundle);
  } catch (error) { return marketError(error); }
}
