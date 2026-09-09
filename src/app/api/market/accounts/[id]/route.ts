import { deleteTrackedAccountBundle, listTrackedAccountBundles, saveTrackedAccountBundle } from "@/lib/db";
import { marketError, persistMarketItems, redfoxProvider } from "@/modules/market/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = listTrackedAccountBundles().find(bundle => bundle.account.id === id);
  if (!existing) return Response.json({ error: "追踪账号不存在" }, { status: 404 });
  try {
    const provider = redfoxProvider();
    const input = { platform: existing.account.platform, accountId: existing.account.platformAccountId! };
    const account = { ...await provider.getAccount(input), id: existing.account.id };
    const items = persistMarketItems(await provider.getAccountWorks(input));
    const bundle = { account, items };
    saveTrackedAccountBundle(bundle);
    return Response.json(bundle);
  } catch (error) { return marketError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteTrackedAccountBundle(id);
  return Response.json({ success: true });
}
