export const reviewIssueCategories = ["fact", "style", "platform"] as const;
export const reviewRiskLevels = ["low", "medium", "high", "blocked"] as const;

export type ReviewIssueCategory = (typeof reviewIssueCategories)[number];
export type ReviewRiskLevel = (typeof reviewRiskLevels)[number];

export type ReviewIssue = {
  id: string;
  category: ReviewIssueCategory;
  severity: ReviewRiskLevel;
  title: string;
  description: string;
  originalText: string;
  suggestedText: string;
  autoFixable: boolean;
  requiresConfirmation: boolean;
  status: "open" | "applied";
};

export type ChannelReview = {
  conclusion: string;
  riskLevel: ReviewRiskLevel;
  issues: ReviewIssue[];
  reviewedContent: string;
  reviewedAt: string;
};

export function isReviewIssueCategory(value: unknown): value is ReviewIssueCategory {
  return typeof value === "string" && reviewIssueCategories.includes(value as ReviewIssueCategory);
}

export function isReviewRiskLevel(value: unknown): value is ReviewRiskLevel {
  return typeof value === "string" && reviewRiskLevels.includes(value as ReviewRiskLevel);
}
