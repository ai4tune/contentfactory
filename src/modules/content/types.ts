import type { AccountContext } from "@/modules/positioning/types";

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

export type ContentProject = {
  id: string;
  topic: string;
  accountSnapshot: AccountContext | null;
  selectedKnowledgeRefs: ContentCitation[];
  brief: ContentBrief;
  status: "brief_confirmed";
  createdAt: string;
  updatedAt: string;
};
