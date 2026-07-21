import type { PositioningRequest, PositioningResult } from "@/lib/ai";

export type AccountContextStatus = "confirmed" | "skipped";

export type AccountContext = {
  id: "current-account";
  status: AccountContextStatus;
  source: "manual" | "capture";
  accountName: string;
  business: string;
  platforms: string[];
  accountPosition: string;
  targetAudience: string[];
  offer: string;
  conversionGoal: string;
  contentPillars: string[];
  brandVoice: string[];
  preferredPhrases: string[];
  bannedPhrases: string[];
  contentDirections: string[];
  recommendedTopics: string[];
  analysisEvidence: string[];
  informationGaps: string[];
  confirmedAt?: string;
  updatedAt: string;
};

export type AccountContextDraft = Omit<
  AccountContext,
  "id" | "status" | "confirmedAt" | "updatedAt"
> & {
  input: PositioningRequest;
};

export function createAccountContextDraft(
  input: PositioningRequest,
  result: PositioningResult,
  source: AccountContext["source"] = "manual",
): AccountContextDraft {
  return {
    source,
    input,
    accountName: input.accountName || "未命名账号",
    business: input.business,
    platforms: splitList(input.platforms),
    accountPosition: result.accountPosition,
    targetAudience: result.targetAudience.length ? result.targetAudience : splitList(input.audience),
    offer: input.offer,
    conversionGoal: input.goal || "",
    contentPillars: result.contentPillars ?? [],
    brandVoice: result.brandVoice ?? [],
    preferredPhrases: result.preferredPhrases ?? [],
    bannedPhrases: result.bannedPhrases ?? [],
    contentDirections: result.contentAngles ?? [],
    recommendedTopics: result.recommendedTopics ?? [],
    analysisEvidence: result.analysisEvidence ?? [],
    informationGaps: result.questionsToConfirm ?? [],
  };
}

export function splitList(value?: string) {
  return (value ?? "")
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
