import type { AccountContext } from "@/modules/positioning/types";
import type { ChannelReview } from "@/modules/reviews/types";

export type BriefKnowledgeSource = {
  id: string;
  title: string;
  source: "local" | "feishu" | "base" | "upload";
  text: string;
  url?: string;
  path?: string;
};

export type ContentCitation = {
  sourceId: string;
  sourceTitle: string;
  sourceType: BriefKnowledgeSource["source"];
  excerpt: string;
  purpose: string;
  url?: string;
  path?: string;
};

export type ContentBrief = {
  targetAudience: string;
  contentGoal: string;
  coreMessage: string;
  keyPoints: string[];
  outline: string[];
  callToAction: string;
  citations: ContentCitation[];
  openQuestions: string[];
};

export const contentChannels = [
  "wechat_article",
  "xiaohongshu_note",
  "moments_post",
  "short_video_script",
] as const;

export type ContentChannel = (typeof contentChannels)[number];

export const channelLabels: Record<ContentChannel, string> = {
  wechat_article: "公众号文章",
  xiaohongshu_note: "小红书文案",
  moments_post: "朋友圈文案",
  short_video_script: "短视频脚本",
};

export type ChannelDraft = {
  channel: ContentChannel;
  content: string;
  status: "generated" | "failed";
  error?: string;
  review?: ChannelReview;
  updatedAt: string;
};

export type ContentProject = {
  id: string;
  topic: string;
  accountSnapshot: AccountContext | null;
  selectedKnowledgeRefs: ContentCitation[];
  brief: ContentBrief;
  channels: ContentChannel[];
  channelDrafts: ChannelDraft[];
  status: "brief_confirmed" | "generated" | "partially_failed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type GenerateChannelsRequest = {
  topic: string;
  channels: ContentChannel[];
  brief: ContentBrief;
  sources: BriefKnowledgeSource[];
  projectId?: string;
};

export function isContentChannel(value: unknown): value is ContentChannel {
  return typeof value === "string" && contentChannels.includes(value as ContentChannel);
}
