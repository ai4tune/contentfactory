import { createRedFoxProvider } from "./providers/redfox-provider";
import { upsertMarketItemToDb } from "@/lib/db";
import type { MarketItem } from "./types";

export function redfoxProvider() {
  if (!process.env.REDFOX_API_KEY) throw new Error("请在 .env.local 配置 REDFOX_API_KEY，重启服务后再试。");
  return createRedFoxProvider({ name: "redfox", enabled: true, apiKey: process.env.REDFOX_API_KEY,
    baseUrl: process.env.REDFOX_BASE_URL || (process.env.REDFOX_HOST ? `https://${process.env.REDFOX_HOST}` : undefined) });
}

export function persistMarketItems(items: MarketItem[]) {
  return items.map(item => ({ ...item, id: upsertMarketItemToDb({
    ...item, authorId: item.author.id, authorName: item.author.name,
    authorFollowers: item.author.followers ?? undefined, authorProfileUrl: item.author.profileUrl,
    views: item.metrics.views ?? undefined, likes: item.metrics.likes ?? undefined,
    collects: item.metrics.collects ?? undefined, comments: item.metrics.comments ?? undefined,
    shares: item.metrics.shares ?? undefined,
  }) }));
}

export function dateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dateOffset(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }
export function chinaToday() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
export function marketError(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "数据源调用失败，请重试。" }, { status: 502 });
}
