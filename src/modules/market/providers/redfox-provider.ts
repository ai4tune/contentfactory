// RedFox 市场数据提供者
// 封装 RedFox API 调用

import type {
  MarketItem,
  MarketAccount,
  MarketComment,
  SearchWorksInput,
  TrendingInput,
  AccountInput,
  AccountWorksInput,
  CommentsInput,
} from "../types";
import type { MarketDataProvider, ProviderConfig } from "./types";
import { generateCacheKey } from "./types";
import {
  getProviderCache,
  setProviderCache,
  saveProviderCallLog,
} from "@/lib/db";

// RedFox API 端点
const REDFOX_ENDPOINTS: Record<string, string> = {
  xhsSearch: "xhs/search/search",
  xhsUserSearch: "xhsUser/searchArticle",
  xhsUserQuery: "xhsUser/query",
  xhsUserQueryWithWorks: "xhsUser/queryAccountDetail",
  dySearch: "dyData/searchArticle",
  dyUserQuery: "dyData/queryUser",
  dyUserQueryWithWorks: "dyData/queryUserWithWorks",
  gzhSearch: "gzhData/searchArticle",
  gzhUserQuery: "gzhData/queryUser",
  hotKeyword: "hotKeyword/list",
  hotSpot: "hotSpot/getListByPlatform",
};

// 缓存 TTL 配置（毫秒）
const CACHE_TTL: Record<string, number> = {
  [REDFOX_ENDPOINTS.xhsSearch]: 30 * 60 * 1000, // 30 分钟
  [REDFOX_ENDPOINTS.xhsUserSearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.dySearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.gzhSearch]: 30 * 60 * 1000,
  [REDFOX_ENDPOINTS.hotKeyword]: 10 * 60 * 1000, // 10 分钟
  [REDFOX_ENDPOINTS.hotSpot]: 30 * 60 * 1000,
  default: 60 * 60 * 1000, // 1 小时
};

// 创建 RedFox 提供者
export function createRedFoxProvider(config: ProviderConfig): MarketDataProvider {
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
    const url = `${baseUrl}/story/api/${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (method === "POST") {
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`RedFox API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  // 带缓存的 API 调用
  async function callWithCache<T>(
    endpoint: string,
    params: Record<string, unknown>,
    method: "GET" | "POST" = "POST"
  ): Promise<T> {
    void method; // 预留 GET 支持
    const cacheKey = generateCacheKey(endpoint, params);
    const startTime = new Date().toISOString();

    // 检查缓存
    const cached = getProviderCache(cacheKey);
    if (cached) {
      const ttl = CACHE_TTL[endpoint] || CACHE_TTL.default;
      const cachedAt = new Date(cached.updated_at as string).getTime();
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
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  // 搜索作品
  async function searchWorks(input: SearchWorksInput): Promise<MarketItem[]> {
    const { platform, keyword, filters, page = 1, pageSize = 20 } = input;

    let endpoint: string;
    let params: Record<string, unknown>;

    switch (platform) {
      case "xiaohongshu":
        endpoint = REDFOX_ENDPOINTS.xhsSearch;
        params = {
          keyword,
          page,
          pageSize,
          sort: "hot",
          ...filters,
        };
        break;

      case "douyin":
        endpoint = REDFOX_ENDPOINTS.dySearch;
        params = {
          keyword,
          pageNum: page,
          pageSize,
          sortType: "like",
          ...filters,
        };
        break;

      case "wechat":
        endpoint = REDFOX_ENDPOINTS.gzhSearch;
        params = {
          keyword,
          pageNum: page,
          pageSize,
          ...filters,
        };
        break;

      default:
        throw new Error(`不支持的平台: ${platform}`);
    }

    const response = await callWithCache<{
      list?: Array<Record<string, unknown>>;
      articles?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    }>(endpoint, params);

    // 提取列表数据
    const items = response.list || response.articles || response.data || [];

    // 转换为 MarketItem 格式
    return items.map((item, index) => {
      const platformContentId = String(item.workId || item.awemeId || item.id || "");
      const stableId = platformContentId ? `${platform}_${platformContentId}` : `${platform}_${Date.now()}_${index}`;
      return {
      id: stableId,
      provider: "redfox",
      platform,
      title: String(item.title || item.workTitle || "").trim() || "(无标题)",
      summary: item.summary ? String(item.summary) : item.desc ? String(item.desc) : item.digest ? String(item.digest) : undefined,
      contentType: item.type === "video" ? "video" as const : "article" as const,
      author: {
        id: String(item.authorId || item.userId || ""),
        name: String(item.authorName || item.nickname || item.author || ""),
        followers: Number(item.fans || item.followers) || null,
        profileUrl: item.profileUrl ? String(item.profileUrl) : item.homePageUrl ? String(item.homePageUrl) : undefined,
      },
      publishedAt: item.publishTime ? String(item.publishTime) : item.createTime ? String(item.createTime) : item.publicTime ? String(item.publicTime) : undefined,
      capturedAt: new Date().toISOString(),
      metrics: {
        views: Number(item.readCount || item.playCount || item.views) || null,
        likes: Number(item.likeCount || item.diggCount || item.likedCount) || null,
        collects: Number(item.collectCount || item.collectedCount) || null,
        comments: Number(item.commentCount) || null,
        shares: Number(item.shareCount) || null,
      },
      keywords: Array.isArray(item.keywords) ? item.keywords : [keyword],
      tags: Array.isArray(item.tags) ? item.tags : [],
      sourceUrl: item.url ? String(item.url) : item.shareUrl ? String(item.shareUrl) : item.link ? String(item.link) : undefined,
      canonicalUrl: String(item.url || item.shareUrl || item.link || ""),
      platformContentId,
    };
    });
  }

  // 获取热榜
  async function getTrending(input: TrendingInput): Promise<MarketItem[]> {
    const { platform, date, category } = input;

    let endpoint: string;
    let params: Record<string, unknown>;

    switch (platform) {
      case "xiaohongshu":
        endpoint = "cozeSkill/getXhsCozeSkillDataOne";
        params = {
          rankDate: date || new Date().toISOString().split("T")[0],
          source: "小红书单日数据爆款文章-GitHub",
          category: category || "综合全部",
        };
        break;

      case "douyin":
        endpoint = "dy/search/likesRank";
        params = {
          source: "抖音",
          type: category || "全部",
          startTime: date || new Date().toISOString().split("T")[0],
          endTime: date || new Date().toISOString().split("T")[0],
        };
        break;

      case "wechat":
        endpoint = "gzh/search/hotArticle";
        params = {
          source: "公众号",
          keyword: "",
          startDate: date || new Date().toISOString().split("T")[0],
          endDate: date || new Date().toISOString().split("T")[0],
          pageNum: 1,
          pageSize: 50,
        };
        break;

      default:
        throw new Error(`不支持的平台: ${platform}`);
    }

    const response = await callWithCache<{
      list?: Array<Record<string, unknown>>;
      articles?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    }>(endpoint, params);

    const items = response.list || response.articles || response.data || [];

    return items.map((item, index) => {
      const platformContentId = String(item.workId || item.awemeId || item.id || "");
      const stableId = platformContentId ? `${platform}_${platformContentId}` : `${platform}_hot_${Date.now()}_${index}`;
      return {
      id: stableId,
      provider: "redfox",
      platform,
      title: String(item.title || item.workTitle || "").trim() || "(无标题)",
      summary: item.summary ? String(item.summary) : item.desc ? String(item.desc) : item.digest ? String(item.digest) : undefined,
      contentType: item.type === "video" ? "video" as const : "article" as const,
      author: {
        id: String(item.authorId || item.userId || ""),
        name: String(item.authorName || item.nickname || item.author || ""),
        followers: Number(item.fans || item.followers) || null,
        profileUrl: item.profileUrl ? String(item.profileUrl) : item.homePageUrl ? String(item.homePageUrl) : undefined,
      },
      publishedAt: item.publishTime ? String(item.publishTime) : item.createTime ? String(item.createTime) : item.publicTime ? String(item.publicTime) : undefined,
      capturedAt: new Date().toISOString(),
      metrics: {
        views: Number(item.readCount || item.playCount || item.views) || null,
        likes: Number(item.likeCount || item.diggCount || item.likedCount) || null,
        collects: Number(item.collectCount || item.collectedCount) || null,
        comments: Number(item.commentCount) || null,
        shares: Number(item.shareCount) || null,
      },
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      sourceUrl: item.url ? String(item.url) : item.shareUrl ? String(item.shareUrl) : item.link ? String(item.link) : undefined,
      canonicalUrl: String(item.url || item.shareUrl || item.link || ""),
      platformContentId,
    };
    });
  }

  // 获取账号信息
  async function getAccount(input: AccountInput): Promise<MarketAccount> {
    const { platform, accountId } = input;

    let endpoint: string;
    let params: Record<string, unknown>;

    switch (platform) {
      case "xiaohongshu":
        endpoint = REDFOX_ENDPOINTS.xhsUserQuery;
        params = { userId: accountId };
        break;

      case "douyin":
        endpoint = REDFOX_ENDPOINTS.dyUserQuery;
        params = { uid: accountId };
        break;

      case "wechat":
        endpoint = REDFOX_ENDPOINTS.gzhUserQuery;
        params = { userId: accountId };
        break;

      default:
        throw new Error(`不支持的平台: ${platform}`);
    }

    const response = await callWithCache<Record<string, unknown>>(endpoint, params);

    return {
      id: `${platform}_${accountId}`,
      provider: "redfox",
      platform,
      platformAccountId: accountId,
      name: String(response.nickname || response.name || response.authorName || ""),
      profileUrl: response.profileUrl ? String(response.profileUrl) : response.homePageUrl ? String(response.homePageUrl) : undefined,
      followers: Number(response.fans || response.followers) || null,
      worksCount: Number(response.worksCount || response.videoCount) || null,
      accountType: "benchmark",
      latestPostAt: response.latestPostAt as string,
      averageEngagement: Number(response.averageEngagement) || null,
      medianEngagement: Number(response.medianEngagement) || null,
      viralCount: Number(response.viralCount) || 0,
      mainTopics: Array.isArray(response.mainTopics) ? response.mainTopics : [],
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // 获取账号作品
  async function getAccountWorks(input: AccountWorksInput): Promise<MarketItem[]> {
    const { platform, accountId, page = 1, pageSize = 20 } = input;

    let endpoint: string;
    let params: Record<string, unknown>;

    switch (platform) {
      case "xiaohongshu":
        endpoint = REDFOX_ENDPOINTS.xhsUserQueryWithWorks;
        params = { userId: accountId, page, pageSize };
        break;

      case "douyin":
        endpoint = REDFOX_ENDPOINTS.dyUserQueryWithWorks;
        params = { uid: accountId, pageNum: page, pageSize };
        break;

      default:
        throw new Error(`不支持的平台: ${platform}`);
    }

    const response = await callWithCache<{
      list?: Array<Record<string, unknown>>;
      works?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    }>(endpoint, params);

    const items = response.list || response.works || response.data || [];

    return items.map((item, index) => {
      const platformContentId = String(item.workId || item.awemeId || item.id || "");
      const stableId = platformContentId ? `${platform}_${platformContentId}` : `${platform}_${accountId}_${Date.now()}_${index}`;
      return {
      id: stableId,
      provider: "redfox",
      platform,
      title: String(item.title || item.workTitle || "").trim() || "(无标题)",
      summary: item.summary ? String(item.summary) : item.desc ? String(item.desc) : undefined,
      contentType: item.type === "video" ? "video" as const : "article" as const,
      author: {
        id: accountId,
        name: String(item.authorName || item.nickname || ""),
        followers: null,
      },
      publishedAt: item.publishTime ? String(item.publishTime) : item.createTime ? String(item.createTime) : undefined,
      capturedAt: new Date().toISOString(),
      metrics: {
        views: Number(item.readCount || item.playCount) || null,
        likes: Number(item.likeCount || item.diggCount) || null,
        collects: Number(item.collectCount) || null,
        comments: Number(item.commentCount) || null,
        shares: Number(item.shareCount) || null,
      },
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      sourceUrl: item.url ? String(item.url) : item.shareUrl ? String(item.shareUrl) : undefined,
      canonicalUrl: String(item.url || item.shareUrl || ""),
      platformContentId,
    };
    });
  }

  // 获取评论（可选）
  const getComments = async (_input: CommentsInput): Promise<MarketComment[]> => {
    // TODO: 实现评论获取
    return [];
  };

  return {
    searchWorks,
    getTrending,
    getAccount,
    getAccountWorks,
    getComments,
  };
}
