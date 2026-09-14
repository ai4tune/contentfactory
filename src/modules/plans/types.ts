import type { ContentChannel } from "@/modules/content/types";

export const contentPlanStatuses = ["draft", "confirmed", "archived"] as const;
export type ContentPlanStatus = (typeof contentPlanStatuses)[number];

export const contentPlanItemStatuses = [
  "pending",
  "writing",
  "generated",
  "published",
  "reviewed",
] as const;
export type ContentPlanItemStatus = (typeof contentPlanItemStatuses)[number];

export const contentObjectives = ["reach", "trust", "conversion"] as const;
export type ContentObjective = (typeof contentObjectives)[number];

export const contentPlanEvidenceTypes = [
  "enterprise_knowledge",
  "customer_pain",
  "market_signal",
  "inspiration",
] as const;
export type ContentPlanEvidenceType = (typeof contentPlanEvidenceTypes)[number];

export type ContentPlanEvidence = {
  type: ContentPlanEvidenceType;
  refId?: string;
  label: string;
};

export type ContentPillar = {
  id: string;
  name: string;
  description: string;
  priority: number;
};

export type ContentPlanItem = {
  id: string;
  title: string;
  angle?: string;
  pillarId: string;
  objective: ContentObjective;
  rationale: string;
  evidence: ContentPlanEvidence[];
  week: number;
  scheduledDate?: string;
  priority: number;
  locked: boolean;
  origin: "ai" | "manual";
  status: ContentPlanItemStatus;
  contentProjectId?: string;
  publicationId?: string;
  editedAt?: string;
  updatedAt: string;
};

export type ContentPlan = {
  id: string;
  schemaVersion: 1;
  accountContextUpdatedAt: string;
  styleProfileVersion?: number;
  title: string;
  operatingGoal: string;
  primaryChannel: ContentChannel;
  targetAudience: string[];
  pillars: ContentPillar[];
  publishingFrequency: number;
  periodStart: string;
  periodEnd: string;
  status: ContentPlanStatus;
  items: ContentPlanItem[];
  createdAt: string;
  updatedAt: string;
};

export type ContentPlanGenerationOptions = {
  operatingGoal: string;
  primaryChannel: ContentChannel;
  targetAudience: string[];
  publishingFrequency: number;
  periodStart: string;
  periodEnd: string;
  contextEvidence: ContentPlanEvidence[];
};

export type GeneratedContentPlan = {
  title: string;
  pillars: Array<{ name: string; description: string }>;
  items: Array<{
    title: string;
    angle?: string;
    pillarIndex: number;
    objective: ContentObjective;
    rationale: string;
    evidence: ContentPlanEvidence[];
  }>;
};
