import type { ContentChannel, ContentProject } from "@/modules/content/types";

export type DraftReviewStatus = "draft" | "editing" | "approved";

export type DraftVersion = {
  id: string;
  channel: ContentChannel;
  content: string;
  createdAt: string;
};

export type PublicationMetrics = {
  views: number;
  likes: number;
  saves: number;
  comments: number;
  replies: number;
};

export const authorAssessments = [
  "better_than_expected",
  "as_expected",
  "worse_than_expected",
] as const;

export type AuthorAssessment = (typeof authorAssessments)[number];

export type PublicationFeedback = {
  views?: number;
  likes?: number;
  collects?: number;
  comments?: number;
  leads?: number;
  qualitativeFeedback?: string;
  authorAssessment?: AuthorAssessment;
  recordedAt: string;
};

export type ContentPublication = {
  id: string;
  channel: ContentChannel;
  url?: string;
  publishedAt: string;
  updatedAt: string;
  metrics: PublicationMetrics;
  feedback?: PublicationFeedback;
};

export type ContentDraft = ContentProject & {
  reviewStatus: DraftReviewStatus;
  versions: DraftVersion[];
  publications: ContentPublication[];
};

export type DraftListItem = {
  id: string;
  topic: string;
  channels: ContentChannel[];
  generatedChannels: ContentChannel[];
  failedChannels: ContentChannel[];
  reviewStatus: DraftReviewStatus;
  projectStatus: ContentProject["status"];
  knowledgeSourceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DraftFilters = {
  query?: string;
  channel?: ContentChannel;
  reviewStatus?: DraftReviewStatus;
};

export type ContentLibraryItem = {
  id: string;
  draftId: string;
  topic: string;
  channel: ContentChannel;
  excerpt: string;
  reviewStatus: DraftReviewStatus;
  contentPlanId?: string;
  contentPlanItemId?: string;
  publication?: ContentPublication;
  createdAt: string;
  updatedAt: string;
};
