// 市场数据标准化
// 将各平台原始数据转成统一结构

import type { MarketItem, MarketPlatform, MarketMetrics } from "./types";

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

// 标准化数字
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// 标准化小红书数据
export function normalizeXiaohongshuItem(raw: Record<string, unknown>): MarketItem {
  const id = String(raw.workId || raw.id || raw.noteId || generateId());
  const title = String(raw.workTitle || raw.title || raw.workDesc || raw.desc || "").trim();
  const author = (raw.author || raw.userInfo || {}) as Record<string, unknown>;

  return {
    id: `xhs_${id}`,
    provider: "redfox",
    providerItemId: String(id),
    platform: "xiaohongshu",
    platformContentId: String(id),
    canonicalUrl: String(raw.url || raw.shareUrl || `https://www.xiaohongshu.com/explore/${id}`),
    sourceUrl: raw.url ? String(raw.url) : raw.shareUrl ? String(raw.shareUrl) : undefined,
    title: title || "(无标题)",
    summary: raw.workDesc ? String(raw.workDesc) : raw.desc ? String(raw.desc) : undefined,
    body: raw.content ? String(raw.content) : undefined,
    contentType: raw.type === "video" ? "video" : raw.type === "image" ? "image" : "article",
    author: {
      id: String(author.id || author.userId || ""),
      name: String(author.name || author.nickname || ""),
      followers: toNumber(author.fans || author.followers),
      profileUrl: author.profileUrl ? String(author.profileUrl) : author.homePageUrl ? String(author.homePageUrl) : undefined,
    },
    publishedAt: raw.workPublishTime ? String(raw.workPublishTime) : raw.publishTime ? String(raw.publishTime) : raw.gmtCreate ? String(raw.gmtCreate) : undefined,
    capturedAt: new Date().toISOString(),
    metrics: {
      views: toNumber(raw.readCount || raw.views),
      likes: toNumber(raw.workLikedCount || raw.likedCount || raw.likeCount),
      collects: toNumber(raw.workCollectedCount || raw.collectedCount || raw.collectCount),
      comments: toNumber(raw.workCommentCount || raw.commentCount),
      shares: toNumber(raw.shareCount),
    },
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    rawPayloadRef: JSON.stringify(raw).substring(0, 1000),
  };
}

// 标准化抖音数据
export function normalizeDouyinItem(raw: Record<string, unknown>): MarketItem {
  const id = String(raw.workId || raw.awemeId || raw.id || generateId());
  const title = String(raw.title || raw.desc || "").trim();
  const author = (raw.author || raw.authorInfo || {}) as Record<string, unknown>;

  return {
    id: `dy_${id}`,
    provider: "redfox",
    providerItemId: String(id),
    platform: "douyin",
    platformContentId: String(id),
    canonicalUrl: String(raw.shareUrl || raw.url || `https://www.douyin.com/video/${id}`),
    sourceUrl: raw.shareUrl ? String(raw.shareUrl) : raw.url ? String(raw.url) : undefined,
    title: title || "(无标题)",
    summary: raw.desc ? String(raw.desc) : undefined,
    body: raw.content ? String(raw.content) : undefined,
    contentType: raw.video ? "video" : "article",
    author: {
      id: String(author.uid || author.id || ""),
      name: String(author.nickname || author.name || ""),
      followers: toNumber(author.followerCount || author.fans),
      profileUrl: author.profileUrl ? String(author.profileUrl) : author.secUid ? String(author.secUid) : undefined,
    },
    publishedAt: raw.publishTime ? String(raw.publishTime) : raw.createTime ? String(raw.createTime) : undefined,
    capturedAt: new Date().toISOString(),
    metrics: {
      views: toNumber(raw.playCount || raw.views),
      likes: toNumber(raw.diggCount || raw.likeCount),
      collects: toNumber(raw.collectCount || raw.collectCount),
      comments: toNumber(raw.commentCount),
      shares: toNumber(raw.shareCount),
    },
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    rawPayloadRef: JSON.stringify(raw).substring(0, 1000),
  };
}

// 标准化公众号数据
export function normalizeWechatItem(raw: Record<string, unknown>): MarketItem {
  const id = String(raw.workId || raw.id || generateId());
  const title = String(raw.title || "").trim();
  const author = (raw.author || {}) as Record<string, unknown>;

  return {
    id: `gzh_${id}`,
    provider: "redfox",
    providerItemId: String(id),
    platform: "wechat",
    platformContentId: String(id),
    canonicalUrl: String(raw.url || raw.link || ""),
    sourceUrl: raw.url ? String(raw.url) : raw.link ? String(raw.link) : undefined,
    title: title || "(无标题)",
    summary: raw.digest ? String(raw.digest) : raw.summary ? String(raw.summary) : undefined,
    body: raw.content ? String(raw.content) : undefined,
    contentType: "article",
    author: {
      id: String(author.id || ""),
      name: String(author.name || raw.accountName || ""),
      followers: toNumber(author.fans || raw.fans),
      profileUrl: author.profileUrl ? String(author.profileUrl) : undefined,
    },
    publishedAt: raw.publicTime ? String(raw.publicTime) : raw.publishTime ? String(raw.publishTime) : undefined,
    capturedAt: new Date().toISOString(),
    metrics: {
      views: toNumber(raw.readCount || raw.views),
      likes: toNumber(raw.likeCount || raw.likes),
      collects: toNumber(raw.collectCount),
      comments: toNumber(raw.commentCount),
      shares: toNumber(raw.shareCount),
    },
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    rawPayloadRef: JSON.stringify(raw).substring(0, 1000),
  };
}

// 根据平台选择标准化函数
export function normalizeMarketItem(
  platform: MarketPlatform,
  raw: Record<string, unknown>
): MarketItem {
  switch (platform) {
    case "xiaohongshu":
      return normalizeXiaohongshuItem(raw);
    case "douyin":
      return normalizeDouyinItem(raw);
    case "wechat":
      return normalizeWechatItem(raw);
    default:
      // 通用标准化
      return {
        id: `${platform}_${String(raw.id || raw.workId || generateId())}`,
        provider: "redfox",
        providerItemId: String(raw.id || raw.workId),
        platform,
        platformContentId: String(raw.id || raw.workId),
        canonicalUrl: String(raw.url || raw.shareUrl || ""),
        sourceUrl: raw.url ? String(raw.url) : raw.shareUrl ? String(raw.shareUrl) : undefined,
        title: String(raw.title || "").trim() || "(无标题)",
        summary: raw.summary ? String(raw.summary) : raw.desc ? String(raw.desc) : undefined,
        body: raw.content ? String(raw.content) : undefined,
        contentType: "unknown",
        author: {
          id: String(raw.authorId || ""),
          name: String(raw.authorName || raw.author || ""),
          followers: toNumber(raw.authorFollowers || raw.fans),
          profileUrl: raw.authorProfileUrl ? String(raw.authorProfileUrl) : undefined,
        },
        publishedAt: raw.publishTime ? String(raw.publishTime) : raw.createTime ? String(raw.createTime) : undefined,
        capturedAt: new Date().toISOString(),
        metrics: {
          views: toNumber(raw.views || raw.readCount),
          likes: toNumber(raw.likes || raw.likeCount),
          collects: toNumber(raw.collects || raw.collectCount),
          comments: toNumber(raw.comments || raw.commentCount),
          shares: toNumber(raw.shares || raw.shareCount),
        },
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        tags: Array.isArray(raw.tags) ? raw.tags : [],
      };
  }
}

// 计算热度分数
export function calculateHotScore(metrics: MarketMetrics): number {
  const views = metrics.views || 0;
  const likes = metrics.likes || 0;
  const collects = metrics.collects || 0;
  const comments = metrics.comments || 0;
  const shares = metrics.shares || 0;

  // 对数归一化
  const logViews = Math.log10(views + 1);
  const logLikes = Math.log10(likes + 1);
  const logCollects = Math.log10(collects + 1);
  const logComments = Math.log10(comments + 1);
  const logShares = Math.log10(shares + 1);

  // 加权计算
  const score =
    logViews * 0.2 +
    logLikes * 0.3 +
    logCollects * 0.25 +
    logComments * 0.15 +
    logShares * 0.1;

  // 归一化到 0-100
  return Math.min(100, Math.round(score * 20));
}

// 计算相对分数（相对于作者正常水平）
export function calculateRelativeScore(
  currentMetrics: MarketMetrics,
  medianMetrics: MarketMetrics
): number {
  const currentEngagement =
    (currentMetrics.likes || 0) +
    (currentMetrics.collects || 0) * 1.5 +
    (currentMetrics.comments || 0) * 2 +
    (currentMetrics.shares || 0) * 2;

  const medianEngagement =
    (medianMetrics.likes || 0) +
    (medianMetrics.collects || 0) * 1.5 +
    (medianMetrics.comments || 0) * 2 +
    (medianMetrics.shares || 0) * 2;

  if (medianEngagement === 0) return currentEngagement > 0 ? 50 : 0;

  const ratio = currentEngagement / medianEngagement;

  // 归一化到 0-100
  if (ratio < 1) return Math.round(ratio * 30);
  if (ratio < 2) return 30 + Math.round((ratio - 1) * 20);
  if (ratio < 3) return 50 + Math.round((ratio - 2) * 15);
  if (ratio < 5) return 65 + Math.round((ratio - 3) * 10);
  return Math.min(100, 85 + Math.round((ratio - 5) * 3));
}

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
