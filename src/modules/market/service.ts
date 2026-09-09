// 市场模块服务
// 提供市场数据的业务逻辑

import type {
  MarketItem,
  MarketAccount,
  MarketPlatform,
  SearchResult,
  OpportunityScore,
  TrendItem,
} from "./types";
import type { MarketDataProvider } from "./providers/types";
import { normalizeMarketItem, calculateHotScore } from "./normalization";
import { rankMarketItems, calculateTrendStatus, calculateGrowthRate } from "./ranking";
import {
  saveMarketItems,
  getMarketItem,
  listMarketItems,
  isDuplicate,
  saveMarketAccount,
  listMarketAccounts,
  calculateAccountMedianMetrics,
  saveMetricSnapshot,
} from "./repository";

// 市场服务配置
export type MarketServiceConfig = {
  providers: Map<string, MarketDataProvider>;
  defaultProvider?: string;
  audienceKeywords?: string[];
  businessKeywords?: string[];
  knowledgeKeywords?: string[];
};

// 创建市场服务
export function createMarketService(config: MarketServiceConfig) {
  const {
    providers,
    defaultProvider,
    audienceKeywords = [],
    businessKeywords = [],
    knowledgeKeywords = [],
  } = config;

  // 获取提供者
  function getProvider(name?: string): MarketDataProvider {
    const providerName = name || defaultProvider;
    if (!providerName) {
      throw new Error("未指定市场数据提供者");
    }
    const provider = providers.get(providerName);
    if (!provider) {
      throw new Error(`未找到市场数据提供者: ${providerName}`);
    }
    return provider;
  }

  // 搜索市场内容
  async function searchMarketContent(
    platform: MarketPlatform,
    keyword: string,
    options: {
      provider?: string;
      page?: number;
      pageSize?: number;
      minHotScore?: number;
    } = {}
  ): Promise<SearchResult> {
    const {
      provider: providerName,
      page = 1,
      pageSize = 20,
      minHotScore = 0,
    } = options;

    const provider = getProvider(providerName);

    // 调用提供者搜索
    const rawItems = await provider.searchWorks({
      platform,
      keyword,
      page,
      pageSize,
    });

    // 标准化
    const normalizedItems = rawItems.map((item) =>
      normalizeMarketItem(platform, item as unknown as Record<string, unknown>)
    );

    // 去重
    const newItems = normalizedItems.filter((item) => !isDuplicate(item));

    // 保存新项目
    saveMarketItems(newItems);

    // 排名
    const rankedItems = rankMarketItems(newItems, {
      audienceKeywords,
      businessKeywords,
      knowledgeKeywords,
      sortBy: "total",
      limit: pageSize,
    });

    // 过滤最低热度
    const filteredItems = rankedItems.filter(
      (item) => item.opportunityScore.total >= minHotScore
    );

    return {
      items: filteredItems,
      totalCount: filteredItems.length,
      page,
      pageSize,
      expandedKeywords: [keyword], // TODO: 实现关键词扩展
    };
  }

  // 获取热榜
  async function getHotList(
    platform: MarketPlatform,
    options: {
      provider?: string;
      date?: string;
      category?: string;
    } = {}
  ): Promise<MarketItem[]> {
    const { provider: providerName, date, category } = options;
    const provider = getProvider(providerName);

    const rawItems = await provider.getTrending({
      platform,
      date,
      category,
    });

    // 标准化
    const normalizedItems = rawItems.map((item) =>
      normalizeMarketItem(platform, item as unknown as Record<string, unknown>)
    );

    // 去重并保存
    const newItems = normalizedItems.filter((item) => !isDuplicate(item));
    saveMarketItems(newItems);

    // 按热度排序
    return rankMarketItems(newItems, {
      sortBy: "hotScore",
      limit: 50,
    });
  }

  // 获取市场项目详情
  async function getMarketItemDetail(id: string): Promise<MarketItem | null> {
    return getMarketItem(id);
  }

  // 收藏市场项目
  async function saveToFavorites(id: string): Promise<MarketItem | null> {
    const item = getMarketItem(id);
    if (!item) return null;

    // 保存指标快照
    saveMetricSnapshot({
      marketItemId: item.id,
      capturedAt: new Date().toISOString(),
      metrics: item.metrics,
    });

    return item;
  }

  // 追踪账号
  async function trackAccount(
    platform: MarketPlatform,
    accountId: string,
    accountType: MarketAccount["accountType"] = "benchmark"
  ): Promise<MarketAccount> {
    const provider = getProvider();

    // 获取账号信息
    const rawAccount = await provider.getAccount({
      platform,
      accountId,
    });

    // 保存账号
    const account: MarketAccount = {
      ...rawAccount,
      accountType,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return saveMarketAccount(account);
  }

  // 获取账号作品
  async function getAccountWorks(
    platform: MarketPlatform,
    accountId: string,
    options: {
      provider?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<MarketItem[]> {
    const { provider: providerName, page = 1, pageSize = 20 } = options;
    const provider = getProvider(providerName);

    const rawItems = await provider.getAccountWorks({
      platform,
      accountId,
      page,
      pageSize,
    });

    // 标准化
    const normalizedItems = rawItems.map((item) =>
      normalizeMarketItem(platform, item as unknown as Record<string, unknown>)
    );

    // 去重并保存
    const newItems = normalizedItems.filter((item) => !isDuplicate(item));
    saveMarketItems(newItems);

    return newItems;
  }

  // 计算机会评分
  function calculateOpportunity(
    item: MarketItem
  ): OpportunityScore {
    const medianMetrics = calculateAccountMedianMetrics(item.author.id || "");

    return rankMarketItems([item], {
      medianMetrics: medianMetrics || undefined,
      audienceKeywords,
      businessKeywords,
      knowledgeKeywords,
    })[0]?.opportunityScore || {
      hotScore: 0,
      relativeScore: 0,
      audienceFit: 0,
      businessScore: 0,
      knowledgeFit: 0,
      total: 0,
    };
  }

  // 获取趋势
  async function getTrends(
    platform: MarketPlatform,
    keyword: string,
    options: {
      days?: number;
    } = {}
  ): Promise<TrendItem[]> {
    const { days: _days = 7 } = options;

    // 获取历史数据
    const items = listMarketItems({
      platform,
      keyword,
      limit: 100,
    });

    // 按日期分组
    const itemsByDate = new Map<string, MarketItem[]>();
    for (const item of items) {
      const date = item.publishedAt
        ? new Date(item.publishedAt).toISOString().split("T")[0]
        : new Date(item.capturedAt).toISOString().split("T")[0];

      const dateItems = itemsByDate.get(date) || [];
      dateItems.push(item);
      itemsByDate.set(date, dateItems);
    }

    // 计算趋势
    const trends: TrendItem[] = [];
    const dates = Array.from(itemsByDate.keys()).sort();

    if (dates.length < 2) {
      return trends;
    }

    const current = itemsByDate.get(dates[dates.length - 1]) || [];
    const previous = itemsByDate.get(dates[dates.length - 2]) || [];

    const currentScore = current.reduce((sum, item) => sum + calculateHotScore(item.metrics), 0);
    const previousScore = previous.reduce((sum, item) => sum + calculateHotScore(item.metrics), 0);

    trends.push({
      keyword,
      platform,
      status: calculateTrendStatus(currentScore, previousScore),
      hotScore7d: currentScore,
      hotScore14d: previousScore,
      growthRate: calculateGrowthRate(currentScore, previousScore),
      relatedViralCount: current.filter((item) => calculateHotScore(item.metrics) > 80).length,
      enterpriseFit: 50, // TODO: 计算企业匹配度
      knowledgeCount: 0, // TODO: 计算知识数量
    });

    return trends;
  }

  // 列出追踪的账号
  function listTrackedAccounts(
    platform?: MarketPlatform,
    accountType?: MarketAccount["accountType"]
  ): MarketAccount[] {
    return listMarketAccounts({ platform, accountType });
  }

  return {
    searchMarketContent,
    getHotList,
    getMarketItemDetail,
    saveToFavorites,
    trackAccount,
    getAccountWorks,
    calculateOpportunity,
    getTrends,
    listTrackedAccounts,
  };
}

export type MarketService = ReturnType<typeof createMarketService>;
