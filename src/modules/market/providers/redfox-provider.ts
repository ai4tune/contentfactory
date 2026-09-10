// RedFox 市场数据提供者
// 封装 RedFox API 调用

import type {
  MarketItem,
  MarketAccount,
  SearchWorksInput,
  TrendingInput,
  AccountInput,
  AccountWorksInput,
} from "../types";
import type { ProviderConfig } from "./types";
import { generateCacheKey } from "./types";
import { createHash } from "node:crypto";
import { normalizeRedfoxSearch, redfoxSearchRequest, unwrapRedfoxResponse, marketNumber, safeMarketUrl } from "./redfox-search";
import {
  getProviderCache,
  setProviderCache,
  saveProviderCallLog,
} from "@/lib/db";

// RedFox API 端点
const REDFOX_ENDPOINTS: Record<string, string> = {
  xhsSearch: "xhs/ability/searchWork",
  xhsUserSearch: "xhsUser/searchArticle",
  dySearch: "dyData/searchArticle",
  gzhSearch: "gzhData/searchArticle",
  hotKeyword: "hotKeyword/list",
  hotSpot: "hotSpot/getListByPlatformWithKeyword",
};

// 缓存 TTL 配置（毫秒）
const CACHE_TTL: Record<string, number> = {
  [REDFOX_ENDPOINTS.xhsSearch]: 30 * 60 * 1000, // 30 分钟
  [REDFOX_ENDPOINTS.xhsUserSearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.dySearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.gzhSearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.hotKeyword]: 10 * 60 * 1000, // 10 分钟
  [REDFOX_ENDPOINTS.hotSpot]: 30 * 60 * 1000,
  "sphAllData/searchWork": 30 * 60 * 1000,
  default: 60 * 60 * 1000, // 1 小时
};

// 创建 RedFox 提供者
export function createRedFoxProvider(config: ProviderConfig) {
  const { apiKey, baseUrl = "https://redfox.hk" } = config;

  if (!apiKey) {
    throw new Error("RedFox API Key 未配置");
  }

  // 调用 RedFox API
  async function callRedFoxApi(
    endpoint: string,
    params: Record<string, unknown>,
    method: "GET" | "POST" = "POST"
  ): Promise<unknown> {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/story/api/${endpoint}`);
    if (method === "GET") for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "REDFOX_API_KEY": apiKey!,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(30_000),
    };

    if (method === "POST") {
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`RedFox API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return unwrapRedfoxResponse(data);
  }

  // 带缓存的 API 调用
  async function callWithCache<T>(
    endpoint: string,
    params: Record<string, unknown>,
    method: "GET" | "POST" = "POST"
  ): Promise<T> {
    const accountKey = createHash("sha256").update(`${baseUrl}:${apiKey}`).digest("hex").slice(0, 16);
    const cacheKey = `v3:${method}:${accountKey}:${generateCacheKey(endpoint, params)}`;
    const startTime = new Date().toISOString();

    // 检查缓存
    const cached = getProviderCache(cacheKey);
    if (cached) {
      const ttl = CACHE_TTL[endpoint] || CACHE_TTL.default;
      const cachedAt = new Date(`${String(cached.updated_at).replace(" ", "T")}Z`).getTime();
      if (Date.now() - cachedAt < ttl) {
        // 记录缓存命中
        saveProviderCallLog({
          provider: "redfox",
          endpoint,
          startedAt: startTime,
          finishedAt: new Date().toISOString(),
          success: true,
          cacheHit: true,
          itemCount: 0,
        });

        return JSON.parse(cached.response as string) as T;
      }
    }

    // 调用 API
    try {
      const data = await callRedFoxApi(endpoint, params, method);

      // 缓存响应
      setProviderCache(cacheKey, "redfox", endpoint, JSON.stringify(data));

      // 记录调用
      saveProviderCallLog({
        provider: "redfox",
        endpoint,
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        success: true,
        cacheHit: false,
        itemCount: Array.isArray(data) ? data.length : 1,
      });

      return data as T;
    } catch (error) {
      // 记录错误
      saveProviderCallLog({
        provider: "redfox",
        endpoint,
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        success: false,
        cacheHit: false,
        itemCount: 0,
        errorCode: "API_ERROR",
        errorMessage: (error instanceof Error ? error.message : String(error)).replaceAll(apiKey!, "[redacted]"),
      });

      throw new Error((error instanceof Error ? error.message : String(error)).replaceAll(apiKey!, "[redacted]"));
    }
  }

  // 搜索仅使用官方文档已核对的三个端点，不自动扩散付费请求。
  async function searchWorks(input: SearchWorksInput): Promise<MarketItem[]> {
    const { endpoint, params } = redfoxSearchRequest(input);
    const response = await callWithCache<unknown>(endpoint, params);
    return normalizeRedfoxSearch(response, input);
  }

  // 官方契约：日榜、账号详情及作品列表。每个操作最多一次付费请求。
  async function getTrending(input: TrendingInput): Promise<MarketItem[]> {
    const date = input.date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const platform = input.platform;
    let response: unknown;
    if (platform === "xiaohongshu") {
      response = await callWithCache("cozeSkill/getXhsCozeSkillDataOne", {
        rankDate: date, category: input.category || "综合全部",
      }, "GET");
    } else if (platform === "douyin") {
      response = await callWithCache("dy/search/likesRank", {
        source: "抖音每日热门作品榜-GitHub", ...(input.category ? { type: input.category } : {}), startTime: date, endTime: date,
      });
    } else if (platform === "wechat") {
      response = await callWithCache("gzh/search/hotArticle", { keyword: input.category || "", startDate: date, endDate: date });
    } else {
      throw new Error("该平台暂无已核实的作品热榜接口，请使用主题搜索。");
    }
    const rows = listResponse(response, ["list", "articles", "records"]);
    const list = rows.map(row => ({ ...row, ...(row.anaAdd ? record(row.anaAdd) : {}) }));
    return normalizeRedfoxSearch({ list }, { platform, keyword: input.category || "", pageSize: 50 });
  }

  async function getAccount(input: AccountInput): Promise<MarketAccount> {
    const { platform, accountId } = input;
    let response: unknown;
    if (platform === "xiaohongshu") response = await callWithCache("xhsUser/queryAccountDetail", { accountId });
    else if (platform === "douyin") response = await callWithCache("dyData/queryUser", { accountId });
    else if (platform === "wechat") response = await callWithCache("gzhData/queryUser", { account: accountId });
    else throw new Error("账号追踪暂支持小红书、抖音和公众号；视频号请使用作品搜索。");
    const data = record(response);
    const name = textField(data.accountName ?? data.nickname);
    if (!name) throw new Error("数据源未返回账号信息，请核对平台账号 ID 和收录范围。");
    return {
      id: `${platform}_${textField(data.userId ?? data.uid ?? data.account ?? data.accountId) || accountId}`,
      provider: "redfox", platform, platformAccountId: accountId, name,
      profileUrl: safeMarketUrl(data.profileUrl) || undefined,
      followers: marketNumber(data.accountFans ?? data.followerCount),
      worksCount: marketNumber(data.accountTotalWorks ?? data.awemeCount),
      accountType: "benchmark", mainTopics: [],
      capturedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  async function getAccountWorks(input: AccountWorksInput): Promise<MarketItem[]> {
    const { platform, accountId, page = 1, pageSize = 20 } = input;
    const endpoint = { xiaohongshu: "xhsUser/queryWorkList", douyin: "dyData/queryWorkList", wechat: "gzhData/queryWorkList", channels: "sphAllData/queryWorkList" }[platform as "xiaohongshu" | "douyin" | "wechat" | "channels"];
    if (!endpoint) throw new Error("该平台不支持账号作品查询");
    const params = platform === "channels"
      ? { nickname: accountId, page, size: pageSize }
      : { ...(platform === "xiaohongshu" ? { redId: accountId } : platform === "wechat" ? { account: accountId } : { accountId }), offset: (page - 1) * 20, sortType: "_2" };
    const response = await callWithCache(endpoint, params);
    return normalizeRedfoxSearch({ list: listResponse(response, ["list"]) }, { platform, keyword: "", pageSize });
  }

  async function getHotspots(input: { startDate: string; endDate: string; keyword?: string; platform?: string }): Promise<Hotspot[]> {
    const codes: Record<string, number> = { kuaishou: 1, douyin: 2, weibo: 5, baidu: 7, bilibili: 8, zhihu: 9, toutiao: 10 };
    if (input.platform && !(input.platform in codes)) throw new Error("该平台不支持热搜查询");
    const response = record(await callWithCache("hotSpot/getListByPlatformWithKeyword", {
      platforms: input.platform ? [codes[input.platform]] : [], keywords: input.keyword ? [input.keyword] : [],
      startDate: input.startDate, endDate: input.endDate,
    }));
    const lists: Record<string, string> = { ksList: "kuaishou", dyList: "douyin", wbList: "weibo", bdList: "baidu", bzList: "bilibili", zhList: "zhihu", ttList: "toutiao" };
    if (!Object.keys(lists).some(key => Array.isArray(response[key]))) throw new Error("RedFox 热搜返回缺少榜单");
    return Object.entries(lists).flatMap(([key, platform]) => {
      if (input.platform && input.platform !== platform) return [];
      if (response[key] === undefined) return [];
      return listResponse(response[key], []).map(row => ({
        id: createHash("sha256").update(`${platform}:${textField(row.title)}:${textField(row.url)}`).digest("hex"),
        platform, title: textField(row.title), url: safeMarketUrl(row.url),
        heat: marketNumber(row.hotCount), heatLabel: textField(row.hotCount),
        rank: marketNumber(row.index), observedAt: textField(row.gmtCreate),
      }));
    });
  }

  async function getHotKeywords(input: { startDate: string; endDate: string }): Promise<HotKeyword[]> {
    const response = await callWithCache("hotKeyword/list", { startDate: `${input.startDate} 00:00:00`, endDate: `${input.endDate} 00:00:00` });
    return listResponse(response, []).map(row => ({
      keyword: textField(row.keyword),
      sources: listResponse(row.hotSpotList, []).map(spot => ({ title: textField(spot.title), platform: textField(spot.platName), url: safeMarketUrl(spot.url) })),
    })).slice(0, 10);
  }

  return { searchWorks, getTrending, getAccount, getAccountWorks, getHotspots, getHotKeywords };
}

export type HotKeyword = { keyword: string; sources: { title: string; platform: string; url: string }[] };
export type Hotspot = { id: string; platform: string; title: string; url: string; heat: number | null; heatLabel: string; rank: number | null; observedAt: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RedFox 返回对象格式错误");
  return value as Record<string, unknown>;
}
function textField(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function listResponse(value: unknown, keys: string[]): Record<string, unknown>[] {
  const rows = Array.isArray(value) ? value : keys.map(key => record(value)[key]).find(Array.isArray);
  if (!Array.isArray(rows)) throw new Error("RedFox 返回缺少作品列表");
  return rows.map(record);
}
