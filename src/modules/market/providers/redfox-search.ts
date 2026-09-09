import { createHash } from "node:crypto";
import type { MarketItem, SearchWorksInput } from "../types";

// Contract sources: doc.redfox.hk/474468723e0 and RedFoxHub's
// douyin/774OBKK0, gongzhonghao/PW97QFBS API documentation.
export function redfoxSearchRequest(input: SearchWorksInput) {
  const { platform, keyword, page = 1, pageSize = 20 } = input;
  if (!keyword.trim() || !Number.isInteger(page) || page < 1 || pageSize < 1 || pageSize > 20) {
    throw new Error("搜索参数无效：页码从 1 开始，每页最多 20 条。");
  }
  if (platform === "xiaohongshu") return {
    endpoint: "xhs/ability/searchWork",
    params: { keyword, page, sort: "综合", note_type: "不限", noteTime: "不限" },
  };
  if (platform === "channels") return {
    endpoint: "sphAllData/searchWork",
    params: { keyword, page, size: pageSize, sort: "综合" },
  };
  if (platform === "douyin" || platform === "wechat") return {
    endpoint: platform === "douyin" ? "dyData/searchArticle" : "gzhData/searchArticle",
    params: { keyword, offset: (page - 1) * 20, sortType: platform === "wechat" ? "_0" : "default" },
  };
  throw new Error(`尚未接入 ${platform} 搜索`);
}

export function unwrapRedfoxResponse(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new Error("RedFox 返回格式错误");
  const result = value as Record<string, unknown>;
  if (result.code !== undefined) {
    if (Number(result.code) !== 2000) throw new Error(`RedFox 业务错误 (${String(result.code)})：${String(result.msg ?? result.message ?? "请求失败")}`);
    return result.data;
  }
  return value;
}

export function normalizeRedfoxSearch(value: unknown, input: SearchWorksInput): MarketItem[] {
  const payload = unwrapRedfoxResponse(value) as Record<string, unknown> | null;
  const list = payload?.workList ?? payload?.list;
  if (!Array.isArray(list)) throw new Error("RedFox 搜索返回缺少作品列表，不能当作空结果。");
  const result = new Map<string, MarketItem>();
  for (const raw of list) {
    if (!raw || typeof raw !== "object") throw new Error("RedFox 作品格式错误");
    const item = raw as Record<string, unknown>;
    const sourceUrl = safeMarketUrl(item.noteUrl ?? item.workUrl ?? item.photoJumpUrl ?? item.url ?? item.shareUrl ?? item.link ?? item.videoUrl);
    const platformContentId = str(item.noteId ?? item.workId ?? item.workUuid ?? item.videoId ?? item.awemeId ?? item.id)
      || contentIdFromUrl(input.platform, sourceUrl);
    const title = str(item.noteTitle ?? item.title ?? item.workTitle ?? item.description) || "(无标题)";
    const authorName = str(item.authorName ?? item.accountName ?? item.accountNickname ?? item.userName ?? item.nickname ?? item.author);
    const identity = platformContentId || createHash("sha256").update(sourceUrl || `${authorName}:${title}:${str(item.publishTime ?? item.releaseTime)}`).digest("hex");
    const id = `${input.platform}_${identity}`;
    const type = item.noteType ?? item.workType ?? item.type;
    result.set(id, {
      id, provider: "redfox", platform: input.platform,
      platformContentId: platformContentId || undefined,
      sourceUrl: sourceUrl || undefined, canonicalUrl: sourceUrl || undefined,
      title, summary: str(item.summary ?? item.desc ?? item.workDesc ?? item.digest ?? item.description) || undefined,
      body: str(item.content) || undefined,
      contentType: input.platform === "channels" || type === "video" || type === "视频" ? "video" : type === "normal" || type === "图文" ? "image" : "article",
      author: {
        id: str(item.authorUid ?? item.authorId ?? item.accountUserid ?? item.userId) || undefined,
        name: authorName || undefined,
        followers: number(item.followerCount ?? item.followers ?? item.fans),
        profileUrl: safeMarketUrl(item.authorLink ?? item.userJumpUrl ?? item.profileUrl) || undefined,
      },
      publishedAt: str(item.releaseTime ?? item.publishTime ?? item.workPublishTime ?? item.publicTime) || undefined,
      capturedAt: new Date().toISOString(),
      metrics: {
        views: number(item.readCount ?? item.clicksCount ?? item.playCount ?? item.workReadedCount ?? item.views),
        likes: number(item.thumbCount ?? item.likeCount ?? item.workLikedCount ?? item.useLikeCount ?? item.diggCount),
        collects: number(item.favoriteCount ?? item.collectCount ?? item.workCollectedCount ?? item.collectedCount ?? item.favCount),
        comments: number(item.replyCount ?? item.commentCount ?? item.workCommentsCount ?? item.useCommentCount ?? item.commentsCount),
        shares: number(item.forwardCount ?? item.shareCount ?? item.workSharedCount ?? item.useShareCount),
      },
      keywords: [input.keyword], tags: [],
    });
  }
  return [...result.values()].slice(0, input.pageSize ?? 20);
}

function str(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
export function marketNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().replaceAll(",", "").match(/^(\d+(?:\.\d+)?)\s*(万|亿|w|k)?\+?(?:热度)?$/i);
  if (!match) return null;
  const units: Record<string, number> = { "万": 10000, "亿": 100000000, w: 10000, k: 1000 };
  const parsed = Number(match[1]) * (units[match[2]?.toLowerCase()] ?? 1);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
const number = marketNumber;

export function safeMarketUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? value : ""; } catch { return ""; }
}

function contentIdFromUrl(platform: string, value: string): string {
  if (!value) return "";
  const url = new URL(value);
  if (platform === "xiaohongshu" && /(^|\.)xiaohongshu\.com$/.test(url.hostname)) return url.pathname.match(/\/(?:explore|discovery\/item)\/([^/]+)/)?.[1] || "";
  if (platform === "douyin" && /(^|\.)(?:douyin|iesdouyin)\.com$/.test(url.hostname)) return url.pathname.match(/\/video\/([^/]+)/)?.[1] || "";
  return "";
}
