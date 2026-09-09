// 市场数据提供者接口定义
// 参考 Content Factory V2 - AI Growth OS v2.0 升级规格说明书

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

// 市场数据提供者接口
export interface MarketDataProvider {
  // 搜索作品
  searchWorks(input: SearchWorksInput): Promise<MarketItem[]>;

  // 获取热榜
  getTrending(input: TrendingInput): Promise<MarketItem[]>;

  // 获取账号信息
  getAccount(input: AccountInput): Promise<MarketAccount>;

  // 获取账号作品
  getAccountWorks(input: AccountWorksInput): Promise<MarketItem[]>;

  // 获取评论（可选）
  getComments?(input: CommentsInput): Promise<MarketComment[]>;
}

// 提供者配置
export type ProviderConfig = {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  cache?: {
    enabled: boolean;
    ttlSeconds: number;
  };
};

// 提供者状态
export type ProviderStatus = {
  name: string;
  enabled: boolean;
  lastCallAt?: string;
  lastError?: string;
  callCount: number;
  errorCount: number;
  cacheHitRate: number;
};

// 提供者调用日志
export type ProviderCallLog = {
  id: string;
  provider: string;
  endpoint: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  cacheHit: boolean;
  itemCount: number;
  costEstimate?: number;
  errorCode?: string;
  errorMessage?: string;
};

// 提供者缓存配置
export type CacheConfig = {
  endpoint: string;
  ttlSeconds: number;
  keyFields: string[];
};

// 默认缓存配置
export const DEFAULT_CACHE_CONFIGS: CacheConfig[] = [
  {
    endpoint: "searchWorks",
    ttlSeconds: 6 * 60 * 60, // 6 小时
    keyFields: ["platform", "keyword", "filters", "page"],
  },
  {
    endpoint: "getTrending",
    ttlSeconds: 30 * 60, // 30 分钟
    keyFields: ["platform", "date", "category"],
  },
  {
    endpoint: "getAccount",
    ttlSeconds: 24 * 60 * 60, // 24 小时
    keyFields: ["platform", "accountId"],
  },
  {
    endpoint: "getAccountWorks",
    ttlSeconds: 60 * 60, // 1 小时
    keyFields: ["platform", "accountId", "page"],
  },
];

// 生成缓存键
export function generateCacheKey(
  endpoint: string,
  input: Record<string, unknown>,
  config?: CacheConfig
): string {
  const cacheConfig = config || DEFAULT_CACHE_CONFIGS.find((c) => c.endpoint === endpoint);
  if (!cacheConfig) {
    return `${endpoint}:${JSON.stringify(input)}`;
  }

  const keyParts = cacheConfig.keyFields.map((field) => {
    const value = input[field];
    if (value === undefined || value === null) return `${field}=`;
    if (typeof value === "object") return `${field}=${JSON.stringify(value)}`;
    return `${field}=${String(value)}`;
  });

  return `${endpoint}:${keyParts.join("&")}`;
}
