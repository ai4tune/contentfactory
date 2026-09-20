import { createRedFoxProvider } from "./providers/redfox-provider";
import { upsertMarketItemToDb, type TrackedAccountBundle } from "@/lib/db";
import type { MarketAccount, MarketItem, OpportunityScore } from "./types";

const PUBLIC_PROVIDER_NAME = "market-data";

export function marketProvider() {
  if (!process.env.REDFOX_API_KEY) throw new Error("市场数据服务尚未配置，请联系管理员完成配置后重试。");
  return createRedFoxProvider({ name: "redfox", enabled: true, apiKey: process.env.REDFOX_API_KEY,
    baseUrl: process.env.REDFOX_BASE_URL || (process.env.REDFOX_HOST ? `https://${process.env.REDFOX_HOST}` : undefined) });
}

export async function persistMarketItems(items: Array<MarketItem & { opportunityScore?: OpportunityScore }>) {
  return Promise.all(items.map(async (item) => publicMarketItem({ ...item, id: await upsertMarketItemToDb({
      ...item, authorId: item.author.id, authorName: item.author.name,
      authorFollowers: item.author.followers ?? undefined, authorProfileUrl: item.author.profileUrl,
      views: item.metrics.views ?? undefined, likes: item.metrics.likes ?? undefined,
      collects: item.metrics.collects ?? undefined, comments: item.metrics.comments ?? undefined,
      shares: item.metrics.shares ?? undefined,
      opportunityScore: item.opportunityScore?.total,
    }) })));
}

export function publicMarketItem(item: MarketItem): MarketItem {
  return { ...item, provider: PUBLIC_PROVIDER_NAME };
}

export function publicMarketAccount(account: MarketAccount): MarketAccount {
  return { ...account, provider: PUBLIC_PROVIDER_NAME };
}

export function publicTrackedAccountBundle(bundle: TrackedAccountBundle): TrackedAccountBundle {
  return {
    account: publicMarketAccount(bundle.account),
    items: bundle.items.map(publicMarketItem),
  };
}

export function dateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dateOffset(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }
export function chinaToday() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
export function marketError(error: unknown) {
  const message = error instanceof Error && error.message.startsWith("市场数据服务尚未配置")
    ? error.message
    : "市场数据服务暂时不可用，请稍后重试。";
  return Response.json({ error: message }, { status: 502 });
}
