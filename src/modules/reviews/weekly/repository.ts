import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { WeeklyReview } from "./types";

type WeeklyReviewStore = {
  schemaVersion: 1;
  reviews: WeeklyReview[];
};

const storePath = path.join(process.cwd(), "data", "weekly-reviews.local.json");
const emptyStore: WeeklyReviewStore = { schemaVersion: 1, reviews: [] };

export async function listWeeklyReviews(contentPlanId: string): Promise<WeeklyReview[]> {
  const store = await readJsonFile<WeeklyReviewStore>(storePath, emptyStore);
  return (Array.isArray(store.reviews) ? store.reviews : [])
    .filter((review) => review.contentPlanId === contentPlanId)
    .sort((left, right) => right.week - left.week || right.createdAt.localeCompare(left.createdAt));
}

export async function saveWeeklyReview(review: WeeklyReview): Promise<WeeklyReview> {
  await updateJsonFile<WeeklyReviewStore>(storePath, emptyStore, (store) => ({
    schemaVersion: 1,
    reviews: [
      ...(Array.isArray(store.reviews) ? store.reviews : []).filter((item) => item.id !== review.id),
      review,
    ],
  }));
  return review;
}

export async function confirmWeeklyReview(
  contentPlanId: string,
  reviewId: string,
): Promise<WeeklyReview | null> {
  let updated: WeeklyReview | null = null;
  await updateJsonFile<WeeklyReviewStore>(storePath, emptyStore, (store) => ({
    schemaVersion: 1,
    reviews: (Array.isArray(store.reviews) ? store.reviews : []).map((review) => {
      if (review.id !== reviewId || review.contentPlanId !== contentPlanId) return review;
      updated = review.confirmedAt
        ? review
        : { ...review, confirmedAt: new Date().toISOString() };
      return updated;
    }),
  }));
  return updated;
}
