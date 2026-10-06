import type { BriefKnowledgeSource } from "@/modules/content/types";
import type { EnterpriseKnowledgeProfileInput } from "@/modules/knowledge-profile/types";
import type { KnowledgeOrganizationPlan } from "../organization";

export type KnowledgeTaskKind = "profile" | "organization";
export type KnowledgeTaskStatus = "queued" | "running" | "retrying" | "succeeded" | "failed";

export type KnowledgeTask = {
  id: string;
  kind: KnowledgeTaskKind;
  status: KnowledgeTaskStatus;
  attempt: number;
  runId?: string;
  sourceCount: number;
  completedBatches: number;
  totalBatches: number;
  stage: string;
  estimatedMinutes: { min: number; max: number };
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  error?: string;
  profileId?: string;
  plan?: KnowledgeOrganizationPlan;
};

export type StoredKnowledgeTask = KnowledgeTask & {
  sources?: BriefKnowledgeSource[];
  batches: Record<string, unknown>;
  compiledProfile?: EnterpriseKnowledgeProfileInput;
};

export function isKnowledgeTaskActive(task: KnowledgeTask) {
  return task.status === "queued" || task.status === "running" || task.status === "retrying";
}

export function publicKnowledgeTask(task: StoredKnowledgeTask): KnowledgeTask {
  const { sources, batches, compiledProfile, ...summary } = task;
  void sources; void batches; void compiledProfile;
  return summary;
}
