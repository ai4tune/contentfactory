// 市场排名和评分模块
// 参考 Content Factory V2 - AI Growth OS v2.0 升级规格说明书

import type { MarketItem, OpportunityScore, MarketPlatform } from "./types";
import { calculateHotScore, calculateRelativeScore } from "./normalization";

// 评分权重配置
const SCORE_WEIGHTS = {
  hotScore: 0.20,
  relativeScore: 0.20,
  audienceFit: 0.25,
  businessScore: 0.20,
  knowledgeFit: 0.15,
};

// 计算机会评分
export function calculateOpportunityScore(
  item: MarketItem,
  options: {
    medianMetrics?: MarketItem["metrics"];
    audienceKeywords?: string[];
    businessKeywords?: string[];
    knowledgeKeywords?: string[];
  } = {}
): OpportunityScore {
  // 热度分数
  const hotScore = calculateHotScore(item.metrics);

  // 相对分数
  const relativeScore = options.medianMetrics
    ? calculateRelativeScore(item.metrics, options.medianMetrics)
    : 50; // 默认 50

  // 受众匹配度
  const audienceFit = calculateAudienceFit(item, options.audienceKeywords);

  // 商业价值
  const businessScore = calculateBusinessScore(item, options.businessKeywords);

  // 知识匹配度
  const knowledgeFit = calculateKnowledgeFit(item, options.knowledgeKeywords);

  // 计算总分
  const total = Math.round(
    hotScore * SCORE_WEIGHTS.hotScore +
    relativeScore * SCORE_WEIGHTS.relativeScore +
    audienceFit * SCORE_WEIGHTS.audienceFit +
    businessScore * SCORE_WEIGHTS.businessScore +
    knowledgeFit * SCORE_WEIGHTS.knowledgeFit
  );

  return {
    hotScore,
    relativeScore,
    audienceFit,
    businessScore,
    knowledgeFit,
    total,
  };
}

// 计算受众匹配度
function calculateAudienceFit(
  item: MarketItem,
  audienceKeywords?: string[]
): number {
  if (!audienceKeywords || audienceKeywords.length === 0) return 50;

  const text = `${item.title} ${item.summary || ""} ${item.keywords.join(" ")}`.toLowerCase();
  const matchCount = audienceKeywords.filter((keyword) =>
    text.includes(keyword.toLowerCase())
  ).length;

  // 匹配比例
  const matchRatio = matchCount / audienceKeywords.length;
  return Math.round(matchRatio * 100);
}

// 计算商业价值
function calculateBusinessScore(
  item: MarketItem,
  businessKeywords?: string[]
): number {
  if (!businessKeywords || businessKeywords.length === 0) return 50;

  const text = `${item.title} ${item.summary || ""} ${item.keywords.join(" ")}`.toLowerCase();
  const matchCount = businessKeywords.filter((keyword) =>
    text.includes(keyword.toLowerCase())
  ).length;

  // 匹配比例
  const matchRatio = matchCount / businessKeywords.length;
  return Math.round(matchRatio * 100);
}

// 计算知识匹配度
function calculateKnowledgeFit(
  item: MarketItem,
  knowledgeKeywords?: string[]
): number {
  if (!knowledgeKeywords || knowledgeKeywords.length === 0) return 50;

  const text = `${item.title} ${item.summary || ""} ${item.keywords.join(" ")}`.toLowerCase();
  const matchCount = knowledgeKeywords.filter((keyword) =>
    text.includes(keyword.toLowerCase())
  ).length;

  // 匹配比例
  const matchRatio = matchCount / knowledgeKeywords.length;
  return Math.round(matchRatio * 100);
}

// 排名市场项目
export function rankMarketItems(
  items: MarketItem[],
  options: {
    medianMetrics?: MarketItem["metrics"];
    audienceKeywords?: string[];
    businessKeywords?: string[];
    knowledgeKeywords?: string[];
    sortBy?: "hotScore" | "relativeScore" | "audienceFit" | "businessScore" | "knowledgeFit" | "total";
    limit?: number;
  } = {}
): Array<MarketItem & { opportunityScore: OpportunityScore }> {
  const {
    medianMetrics,
    audienceKeywords,
    businessKeywords,
    knowledgeKeywords,
    sortBy = "total",
    limit = 20,
  } = options;

  // 计算每个项目的机会评分
  const scoredItems = items.map((item) => ({
    ...item,
    opportunityScore: calculateOpportunityScore(item, {
      medianMetrics,
      audienceKeywords,
      businessKeywords,
      knowledgeKeywords,
    }),
  }));

  // 排序
  scoredItems.sort((a, b) => {
    switch (sortBy) {
      case "hotScore":
        return b.opportunityScore.hotScore - a.opportunityScore.hotScore;
      case "relativeScore":
        return b.opportunityScore.relativeScore - a.opportunityScore.relativeScore;
      case "audienceFit":
        return b.opportunityScore.audienceFit - a.opportunityScore.audienceFit;
      case "businessScore":
        return b.opportunityScore.businessScore - a.opportunityScore.businessScore;
      case "knowledgeFit":
        return b.opportunityScore.knowledgeFit - a.opportunityScore.knowledgeFit;
      case "total":
      default:
        return b.opportunityScore.total - a.opportunityScore.total;
    }
  });

  // 限制数量
  return scoredItems.slice(0, limit);
}

// 按平台归一化分数
export function normalizeByPlatform(
  items: MarketItem[],
  _platform: MarketPlatform
): MarketItem[] {
  // 找到该平台的最大值
  const maxViews = Math.max(...items.map((item) => item.metrics.views || 0));
  const maxLikes = Math.max(...items.map((item) => item.metrics.likes || 0));
  const maxCollects = Math.max(...items.map((item) => item.metrics.collects || 0));
  const maxComments = Math.max(...items.map((item) => item.metrics.comments || 0));
  const maxShares = Math.max(...items.map((item) => item.metrics.shares || 0));

  // 归一化
  return items.map((item) => ({
    ...item,
    metrics: {
      views: maxViews > 0 ? Math.round(((item.metrics.views || 0) / maxViews) * 100) : 0,
      likes: maxLikes > 0 ? Math.round(((item.metrics.likes || 0) / maxLikes) * 100) : 0,
      collects: maxCollects > 0 ? Math.round(((item.metrics.collects || 0) / maxCollects) * 100) : 0,
      comments: maxComments > 0 ? Math.round(((item.metrics.comments || 0) / maxComments) * 100) : 0,
      shares: maxShares > 0 ? Math.round(((item.metrics.shares || 0) / maxShares) * 100) : 0,
    },
  }));
}

// 计算趋势状态
export function calculateTrendStatus(
  currentScore: number,
  previousScore: number
): "rising" | "stable" | "cooling" | "new" {
  if (previousScore === 0) return "new";

  const changeRate = (currentScore - previousScore) / previousScore;

  if (changeRate > 0.2) return "rising";
  if (changeRate < -0.2) return "cooling";
  return "stable";
}

// 计算增长率
export function calculateGrowthRate(
  currentScore: number,
  previousScore: number
): number {
  if (previousScore === 0) return currentScore > 0 ? 100 : 0;
  return Math.round(((currentScore - previousScore) / previousScore) * 100);
}
