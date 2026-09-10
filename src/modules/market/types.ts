// 市场模块类型定义
// 参考 Content Factory V2 - AI Growth OS v2.0 升级规格说明书

// 市场平台类型
export type MarketPlatform =
  | "xiaohongshu"
  | "douyin"
  | "channels"
  | "wechat"
  | "bilibili"
  | "zhihu"
  | "other";

// 市场指标
export type MarketMetrics = {
  views?: number | null;
  likes?: number | null;
  collects?: number | null;
  comments?: number | null;
  shares?: number | null;
};

// 市场内容项
export type MarketItem = {
  id: string;

  provider: string;
  providerItemId?: string;

  platform: MarketPlatform;
  platformContentId?: string;

  canonicalUrl?: string;
  sourceUrl?: string;

  title: string;
  summary?: string;
  body?: string;
  coverUrl?: string;

  contentType: "article" | "image" | "video" | "unknown";

  author: {
    id?: string;
    name?: string;
    followers?: number | null;
    profileUrl?: string;
  };

  publishedAt?: string;
  capturedAt: string;

  metrics: MarketMetrics;

  keywords: string[];
  tags: string[];

  rawPayloadRef?: string;
};

// 市场指标快照
export type MarketMetricSnapshot = {
  marketItemId: string;
  capturedAt: string;
  metrics: MarketMetrics;
};

// 市场账号
export type MarketAccount = {
  id: string;
  provider: string;
  platform: MarketPlatform;
  platformAccountId?: string;

  name: string;
  profileUrl?: string;
  followers?: number | null;
  worksCount?: number | null;

  accountType: "own" | "competitor" | "benchmark" | "inspiration";

  latestPostAt?: string;
  averageEngagement?: number | null;
  medianEngagement?: number | null;
  viralCount?: number;

  mainTopics: string[];

  capturedAt: string;
  updatedAt: string;
};

// 搜索输入
export type SearchWorksInput = {
  platform: MarketPlatform;
  keyword: string;
  filters?: {
    contentType?: "article" | "image" | "video";
    minLikes?: number;
    minViews?: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  page?: number;
  pageSize?: number;
};

// 热榜输入
export type TrendingInput = {
  platform: MarketPlatform;
  date?: string;
  category?: string;
};

// 账号输入
export type AccountInput = {
  platform: MarketPlatform;
  accountId: string;
};

// 账号作品输入
export type AccountWorksInput = {
  platform: MarketPlatform;
  accountId: string;
  page?: number;
  pageSize?: number;
};

// 评论输入
export type CommentsInput = {
  platform: MarketPlatform;
  contentId: string;
  page?: number;
  pageSize?: number;
};

// 评论
export type MarketComment = {
  id: string;
  platform: MarketPlatform;
  contentId: string;
  author: {
    id?: string;
    name?: string;
  };
  text: string;
  likes?: number;
  createdAt?: string;
};

// 市场数据提供者接口
export interface MarketDataProvider {
  searchWorks(input: SearchWorksInput): Promise<MarketItem[]>;
  getTrending(input: TrendingInput): Promise<MarketItem[]>;
  getAccount(input: AccountInput): Promise<MarketAccount>;
  getAccountWorks(input: AccountWorksInput): Promise<MarketItem[]>;
  getComments?(input: CommentsInput): Promise<MarketComment[]>;
}

// 机会评分
export type OpportunityScore = {
  hotScore: number;
  relativeScore: number;
  audienceFit: number;
  businessScore: number;
  knowledgeFit: number;
  total: number;
};

// 趋势状态
export type TrendStatus = "rising" | "stable" | "cooling" | "new";

// 趋势项
export type TrendItem = {
  keyword: string;
  platform: MarketPlatform;
  status: TrendStatus;
  hotScore7d: number;
  hotScore14d: number;
  growthRate: number;
  relatedViralCount: number;
  enterpriseFit: number;
  knowledgeCount: number;
};

// 搜索结果
export type SearchResult = {
  items: MarketItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  expandedKeywords: string[];
  aiInsights?: string;
  recommendedTopics?: string[];
};
