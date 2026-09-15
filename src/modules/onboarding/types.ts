import type { ContentChannel } from "@/modules/content/types";
import type { AccountContext } from "@/modules/positioning/types";
import type { StyleProfile } from "@/modules/style-profile/types";

export const onboardingStates = ["not_started", "in_progress", "completed"] as const;
export type OnboardingState = (typeof onboardingStates)[number];

export const onboardingStepIds = [
  "knowledge",
  "business",
  "positioning",
  "style",
  "primary_channel",
] as const;
export type OnboardingStepId = (typeof onboardingStepIds)[number];

export const knowledgeReadinessValues = ["missing", "minimum", "ready"] as const;
export type KnowledgeReadiness = (typeof knowledgeReadinessValues)[number];

export type OnboardingStatus = {
  version: 1;
  state: OnboardingState;
  completedSteps: OnboardingStepId[];
  primaryChannel?: ContentChannel;
  knowledgeReadiness: KnowledgeReadiness;
  informationGaps: string[];
  completedAt?: string;
  updatedAt: string;
};

export type OnboardingSnapshot = {
  status: OnboardingStatus;
  account: AccountContext | null;
  styleProfile: StyleProfile | null;
  serverKnowledgeCount: number;
};

export type OnboardingAction = "start" | "sync" | "complete" | "restart";

export type OnboardingUpdate = {
  action: OnboardingAction;
  primaryChannel?: ContentChannel;
  localKnowledgeCount?: number;
};
