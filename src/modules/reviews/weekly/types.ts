export type ReviewSuggestionEvidence = {
  contentPlanItemId: string;
  publicationId: string;
  label: string;
};

export type ReviewSuggestion = {
  title: string;
  rationale: string;
  evidence: ReviewSuggestionEvidence[];
};

export type WeeklyReview = {
  id: string;
  contentPlanId: string;
  week: number;
  sampleSize: number;
  continue: ReviewSuggestion[];
  reduce: ReviewSuggestion[];
  adjust: ReviewSuggestion[];
  dataGaps: string[];
  confirmedAt?: string;
  createdAt: string;
};

export type WeeklyReviewPublication = {
  contentPlanItemId: string;
  publicationId: string;
  title: string;
  channel: string;
  views: number;
  likes: number;
  collects: number;
  comments: number;
  leads: number;
  qualitativeFeedback?: string;
  authorAssessment?: string;
};
