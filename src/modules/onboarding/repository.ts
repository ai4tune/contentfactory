import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { ContentChannel } from "@/modules/content/types";
import type {
  KnowledgeReadiness,
  OnboardingState,
  OnboardingStatus,
  OnboardingStepId,
} from "./types";

export type StoredOnboardingStatus = OnboardingStatus & {
  localKnowledgeCount: number;
};

const storePath = path.join(process.cwd(), "data", "onboarding.local.json");

export async function getStoredOnboardingStatus(): Promise<StoredOnboardingStatus> {
  const fallback = emptyStatus();
  const stored = await readJsonFile<Partial<StoredOnboardingStatus>>(storePath, fallback);
  return normalizeStoredStatus(stored, fallback.updatedAt);
}

export async function replaceStoredOnboardingStatus(
  next: StoredOnboardingStatus,
): Promise<StoredOnboardingStatus> {
  return updateJsonFile<Partial<StoredOnboardingStatus>>(storePath, emptyStatus(), () => next)
    .then((stored) => normalizeStoredStatus(stored, next.updatedAt));
}

function emptyStatus(): StoredOnboardingStatus {
  return {
    version: 1,
    state: "not_started",
    completedSteps: [],
    knowledgeReadiness: "missing",
    informationGaps: [],
    localKnowledgeCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStoredStatus(
  value: Partial<StoredOnboardingStatus>,
  fallbackUpdatedAt: string,
): StoredOnboardingStatus {
  const states: OnboardingState[] = ["not_started", "in_progress", "completed"];
  const steps: OnboardingStepId[] = ["knowledge", "business", "positioning", "style", "primary_channel"];
  const readiness: KnowledgeReadiness[] = ["missing", "minimum", "ready"];
  const channels: ContentChannel[] = [
    "wechat_article",
    "xiaohongshu_note",
    "moments_post",
    "short_video_script",
  ];

  return {
    version: 1,
    state: states.includes(value.state as OnboardingState)
      ? value.state as OnboardingState
      : "not_started",
    completedSteps: Array.isArray(value.completedSteps)
      ? value.completedSteps.filter((step): step is OnboardingStepId => steps.includes(step as OnboardingStepId))
      : [],
    primaryChannel: channels.includes(value.primaryChannel as ContentChannel)
      ? value.primaryChannel
      : undefined,
    knowledgeReadiness: readiness.includes(value.knowledgeReadiness as KnowledgeReadiness)
      ? value.knowledgeReadiness as KnowledgeReadiness
      : "missing",
    informationGaps: Array.isArray(value.informationGaps)
      ? value.informationGaps.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20)
      : [],
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
    localKnowledgeCount: normalizeCount(value.localKnowledgeCount),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallbackUpdatedAt,
  };
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? Math.min(count, 100_000) : 0;
}
