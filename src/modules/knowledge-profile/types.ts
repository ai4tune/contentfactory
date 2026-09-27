import type { BriefKnowledgeSource } from "@/modules/content/types";

export type KnowledgeProfileStatus = "draft" | "confirmed" | "archived";
export type KnowledgeFactConfidence = "confirmed" | "needs_confirmation";

export type KnowledgeProfileSource = {
  id: string;
  title: string;
  sourceType: BriefKnowledgeSource["source"];
  url?: string;
  path?: string;
};

export type KnowledgeProfileOffer = {
  id: string;
  name: string;
  description: string;
  differentiators: string[];
  sourceIds: string[];
};

export type KnowledgeProfileFact = {
  id: string;
  category: string;
  statement: string;
  confidence: KnowledgeFactConfidence;
  sourceIds: string[];
};

export type EnterpriseKnowledgeProfileInput = {
  name: string;
  businessSummary: string;
  targetCustomers: string[];
  offers: KnowledgeProfileOffer[];
  strengths: string[];
  businessGoals: string[];
  preferredTopics: string[];
  forbiddenClaims: string[];
  facts: KnowledgeProfileFact[];
  gaps: string[];
  sources: KnowledgeProfileSource[];
};

export type EnterpriseKnowledgeProfile = EnterpriseKnowledgeProfileInput & {
  id: string;
  schemaVersion: 1;
  status: KnowledgeProfileStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
};
