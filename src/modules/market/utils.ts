// 市场模块工具函数
// 提供去重、缓存、标准化等功能

import type { MarketItem, MarketPlatform } from "./types";

// 生成内容指纹（用于去重）
export function generateContentFingerprint(
  platform: MarketPlatform,
  title: string,
  authorName: string,
  publishedAt?: string
): string {
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, "");
  const normalizedAuthor = authorName.toLowerCase().replace(/\s+/g, "");
  const date = publishedAt ? new Date(publishedAt).toISOString().split("T")[0] : "";

  return `${platform}:${normalizedAuthor}:${normalizedTitle}:${date}`;
}

// 检查两个项目是否重复
export function isDuplicateItem(item1: MarketItem, item2: MarketItem): boolean {
  // 1. 检查平台内容 ID
  if (
    item1.platformContentId &&
    item2.platformContentId &&
    item1.platform === item2.platform &&
    item1.platformContentId === item2.platformContentId
  ) {
    return true;
  }

  // 2. 检查 canonical URL
  if (item1.canonicalUrl && item2.canonicalUrl && item1.canonicalUrl === item2.canonicalUrl) {
    return true;
  }

  // 3. 检查内容指纹
  const fingerprint1 = generateContentFingerprint(
    item1.platform,
    item1.title,
    item1.author.name || "",
    item1.publishedAt
  );
  const fingerprint2 = generateContentFingerprint(
    item2.platform,
    item2.title,
    item2.author.name || "",
    item2.publishedAt
  );

  return fingerprint1 === fingerprint2;
}

// 批量去重
export function deduplicateItems(items: MarketItem[]): MarketItem[] {
  const seen: MarketItem[] = [];
  const unique: MarketItem[] = [];

  for (const item of items) {
    const isDuplicate = seen.some((seenItem) => isDuplicateItem(seenItem, item));
    if (!isDuplicate) {
      seen.push(item);
      unique.push(item);
    }
  }

  return unique;
}

// 格式化数字
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "未知";

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }

  return value.toLocaleString();
}

// 格式化时间
export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN");
}

// 格式化平台名称
export function formatPlatformName(platform: MarketPlatform): string {
  const platformNames: Record<MarketPlatform, string> = {
    xiaohongshu: "小红书",
    douyin: "抖音",
    channels: "视频号",
    wechat: "公众号",
    bilibili: "B站",
    zhihu: "知乎",
    other: "其他",
  };

  return platformNames[platform] || platform;
}

// 获取平台颜色
export function getPlatformColor(platform: MarketPlatform): string {
  const platformColors: Record<MarketPlatform, string> = {
    xiaohongshu: "red",
    douyin: "blue",
    channels: "green",
    wechat: "emerald",
    bilibili: "pink",
    zhihu: "blue",
    other: "gray",
  };

  return platformColors[platform] || "gray";
}

// 计算互动率
export function calculateEngagementRate(metrics: MarketItem["metrics"]): number {
  const views = metrics.views || 0;
  if (views === 0) return 0;

  const engagement =
    (metrics.likes || 0) +
    (metrics.collects || 0) +
    (metrics.comments || 0) +
    (metrics.shares || 0);

  return Math.round((engagement / views) * 100 * 100) / 100; // 保留两位小数
}

// 格式化互动率
export function formatEngagementRate(rate: number): string {
  if (rate === 0) return "0%";
  if (rate < 1) return `${rate.toFixed(2)}%`;
  if (rate < 10) return `${rate.toFixed(1)}%`;
  return `${Math.round(rate)}%`;
}

// 生成缓存键
export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  const keyParts = sortedKeys.map((key) => {
    const value = params[key];
    if (value === undefined || value === null) return `${key}=`;
    if (typeof value === "object") return `${key}=${JSON.stringify(value)}`;
    return `${key}=${String(value)}`;
  });

  return `${prefix}:${keyParts.join("&")}`;
}

// 解析 JSON 字符串
export function parseJsonSafe<T>(jsonStr: string | null | undefined, defaultValue: T): T {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return defaultValue;
  }
}

// 截断文本
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// 提取关键词
export function extractKeywords(text: string): string[] {
  // 简单的关键词提取：按空格和标点分割
  const words = text
    .toLowerCase()
    .replace(/[^\w\s一-鿿]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);

  // 去重
  return [...new Set(words)];
}

// 计算相似度（简单版本）
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let matchCount = 0;
  for (const word of words1) {
    if (words2.has(word)) matchCount++;
  }

  return matchCount / Math.max(words1.size, words2.size);
}
