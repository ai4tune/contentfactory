import type { ContentChannel, ContentProject } from "@/modules/content/types";

export type DraftReviewStatus = "draft" | "editing" | "approved";

export type DraftVersion = {
  id: string;
  channel: ContentChannel;
  content: string;
  createdAt: string;
};

export type ContentDraft = ContentProject & {
  reviewStatus: DraftReviewStatus;
  versions: DraftVersion[];
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
