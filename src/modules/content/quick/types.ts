import type { BriefKnowledgeSource, ContentChannel } from "@/modules/content/types";

export type QuickKnowledgeCandidate = {
  refId: string;
  title: string;
  sourceType: BriefKnowledgeSource["source"];
  excerpt?: string;
  url?: string;
  path?: string;
};
export type KnowledgeRecommendation = {
  refId: string;
  title: string;
  sourceType: BriefKnowledgeSource["source"];
  reason: string;
  excerpts: string[];
  selected: boolean;
};

export type QuickCreationInput = {
  contentPlanId: string;
  contentPlanItemId: string;
  channel?: ContentChannel;
  sources: BriefKnowledgeSource[];
};
