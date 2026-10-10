import { createHash } from "node:crypto";
import { marketProvider } from "@/modules/market/server";
import type { MarketItem } from "@/modules/market/types";
import { ChatError } from "@/modules/agent/chat/types";
import type { ResearchRecord, ResearchSource } from "./types";

export const externalResearchTools = ["search_web", "search_peer_content", "read_peer_account", "read_peer_posts", "search_places", "search_nearby_places", "read_place"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 20);
export const researchId = (turnId: string, key: string) => `research_${hash(`${turnId}:${key}`)}`;
export const clean = (value: unknown, max = 3200) => {
  let text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  for (const secret of [process.env.BRAVE_API_KEY, process.env.REDFOX_API_KEY, process.env.AMAP_API_KEY].filter(Boolean)) text = text.replaceAll(secret!, "[redacted]");
  return text.slice(0, max);
};
export function publicUrl(value: unknown) {
  if (typeof value !== "string" || [process.env.BRAVE_API_KEY, process.env.REDFOX_API_KEY, process.env.AMAP_API_KEY].some((key) => key && value.includes(key))) return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined; } catch { return undefined; }
}
function record(id: string, kind: ResearchRecord["kind"], query: ResearchRecord["query"], retrievedAt: string, sources: ResearchSource[], limitations: string[]): ResearchRecord {
  return { id, kind, query, retrievedAt, sources, limitations };
}
export async function searchWeb(id: string, query: { query: string; freshness: "any" | "week" | "month"; limit: number }) {
  const key = process.env.BRAVE_API_KEY?.trim();
  if (!key) throw new ChatError("网页搜索尚未配置，请联系管理员配置搜索服务。", 503);
  const url = new URL(`${process.env.BRAVE_SEARCH_BASE_URL || "https://api.search.brave.com"}/res/v1/web/search`);
  url.search = new URLSearchParams({ q: query.query, count: String(query.limit), search_lang: "zh-hans", country: "ALL", extra_snippets: "true", text_decorations: "false", result_filter: "web", ...(query.freshness === "any" ? {} : { freshness: query.freshness === "week" ? "pw" : "pm" }) }).toString();
  try {
    const response = await fetch(url, { headers: { "X-Subscription-Token": key, Accept: "application/json", "Cache-Control": "no-cache" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new ChatError(response.status === 429 ? "网页搜索额度或频率已受限，请稍后继续。" : "网页搜索服务未返回成功结果，请稍后继续。", 502);
    const data = await response.json();
    if (data?.type !== "search" || (data.web !== undefined && !Array.isArray(data.web?.results))) throw new ChatError("网页搜索返回格式异常，不能当作没有结果。", 502);
    const retrievedAt = new Date().toISOString();
    const sources: ResearchSource[] = [];
    const seen = new Set<string>();
    for (const row of (data.web?.results ?? []).slice(0, query.limit)) {
      const sourceUrl = publicUrl(row.url);
      if (!sourceUrl || seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);
      sources.push({ id: `${id}:source:${hash(sourceUrl)}`, title: clean(row.title, 200) || "无标题网页", url: sourceUrl,
        text: clean([row.description, ...(Array.isArray(row.extra_snippets) ? row.extra_snippets.slice(0, 5) : [])].filter((value) => typeof value === "string").join("\n")),
        provider: "brave", retrievedAt, evidence: "snippet", publishedAt: clean(row.page_age, 100) || undefined });
    }
    return record(id, "web", query, retrievedAt, sources, ["只取得搜索摘要及补充片段，每条最多3200字，未读取网页全文。", "时间筛选依据搜索索引中的页面日期，不保证是文章首次发布时间或完整收录。"]);
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError("网页搜索连接或解析未完成，请稍后继续。", 502);
  }
}
function contentSources(id: string, items: MarketItem[], retrievedAt: string): ResearchSource[] {
  return items.slice(0, 8).map((item) => ({ id: `${id}:source:${hash(item.id)}`, title: clean(item.title, 200),
    url: publicUrl(item.canonicalUrl || item.sourceUrl), text: clean(item.body || item.summary), provider: "redfox", platform: item.platform,
    authorName: clean(item.author.name, 200) || undefined, authorId: clean(item.author.id, 120) || undefined,
    publishedAt: clean(item.publishedAt, 100) || undefined, retrievedAt, evidence: item.body ? "body" : "summary", metrics: item.metrics }));
}
async function platformQuery<T>(work: () => Promise<T>) {
  if (!process.env.REDFOX_API_KEY?.trim()) throw new ChatError("平台调研服务尚未配置，请联系管理员完成配置。", 503);
  try { return await work(); } catch { throw new ChatError("平台调研未取得可用结果，请核对查询条件、账号标识或服务额度后继续。", 502); }
}
export async function searchPeerContent(id: string, query: { platform: "xiaohongshu" | "wechat"; query: string; sort: "综合" | "最新" | "最热" | "最多点赞" | "最多收藏"; timeRange: "不限" | "一周内" | "一个月内" }) {
  const items = await platformQuery(() => marketProvider({ cache: false }).searchWorks({ platform: query.platform, keyword: query.query, sort: query.sort, timeRange: query.timeRange, page: 1, pageSize: 8 }));
  const retrievedAt = new Date().toISOString();
  return record(id, "peer_content", query, retrievedAt, contentSources(id, items, retrievedAt), ["仅查询首批最多8条样本，每条正文或摘要最多3200字，不代表完整原文、全国榜单或已验证的爆款成因。", "缺失正文、发布时间和互动指标保持未知；互动不代表到店效果。"]);
}
export async function readPeerAccount(id: string, query: { platform: "xiaohongshu" | "wechat"; accountId: string }) {
  const account = await platformQuery(() => marketProvider({ cache: false }).getAccount(query));
  const retrievedAt = new Date().toISOString();
  const source: ResearchSource = { id: `${id}:source:${hash(account.id)}`, title: clean(account.name, 200), url: publicUrl(account.profileUrl),
    text: clean(JSON.stringify({ name: account.name, followers: account.followers ?? null, worksCount: account.worksCount ?? null })),
    provider: "redfox", platform: account.platform, authorId: clean(account.platformAccountId, 120), authorName: clean(account.name, 200), retrievedAt, evidence: "profile" };
  return record(id, "peer_account", query, retrievedAt, [source], ["平台资料不等于门店身份已核实，同名及分店仍需核对。"]);
}
export async function readPeerPosts(id: string, query: { platform: "xiaohongshu" | "wechat"; accountId: string }) {
  const items = await platformQuery(() => marketProvider({ cache: false }).getAccountWorks({ ...query, page: 1, pageSize: 8 }));
  const retrievedAt = new Date().toISOString();
  return record(id, "peer_posts", query, retrievedAt, contentSources(id, items, retrievedAt), ["仅取得服务可返回的首批近期作品；账号作品接口所需平台标识可能与昵称、主页ID不同，无法查询时需补充准确标识。"]);
}
