import type { AccountContext } from "@/modules/positioning/types";
import type { ChannelReview } from "@/modules/reviews/types";
import type { StyleContract } from "@/modules/style-profile/types";

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

export type ContentInspirationReference = {
  id: string;
  platform: string;
  title: string;
  sourceUrl?: string;
  metrics?: string;
  summary: string;
  targetAudience: string;
  painPoint: string;
  hook: string;
  pacing: string;
  structure: string[];
  reusablePatterns: string[];
  adaptationIdeas: string[];
  riskNotes: string[];
};

export type InspirationPlanDecision = "adopt" | "adapt" | "discard";

export type ContentInspirationPlanItem = {
  kind: "hook" | "section" | "pacing";
  sourceIndex: number;
  sourceElement: string;
  decision: InspirationPlanDecision;
  plannedUse: string;
  rationale: string;
};

export type ContentInspirationPlan = {
  items: ContentInspirationPlanItem[];
  boundaries: string[];
};

export type ContentIdeaContext = {
  id: string;
  title: string;
  sourceUrl?: string;
  marketItemId?: string;
  inspirationId?: string;
  summary: string;
  excerpt: string;
};

export type ContentBrief = {
  ideaContext?: ContentIdeaContext;
  targetAudience: string;
  contentGoal: string;
  coreMessage: string;
  keyPoints: string[];
  outline: string[];
  callToAction: string;
  citations: ContentCitation[];
  openQuestions: string[];
  inspiration?: ContentInspirationReference;
  inspirationPlan?: ContentInspirationPlan;
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

export type GeneratedVisualAsset = {
  id: string;
  kind: "cover" | "card";
  title: string;
  body?: string;
  points?: string[];
  layout?: "cover" | "explain" | "steps" | "checklist" | "summary";
  prompt?: string;
  status: "generated" | "failed";
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
  updatedAt: string;
};

export type ChannelDraft = {
  channel: ContentChannel;
  content: string;
  status: "generated" | "failed";
  error?: string;
  review?: ChannelReview;
  visualAssets?: GeneratedVisualAsset[];
  updatedAt: string;
};

export type ContentProject = {
  id: string;
  sourceIdeaId?: string;
  topic: string;
  accountSnapshot: AccountContext | null;
  styleSnapshot: StyleContract | null;
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
  temporaryStyleInstructions?: string[];
};

export function isContentChannel(value: unknown): value is ContentChannel {
  return typeof value === "string" && contentChannels.includes(value as ContentChannel);
}
