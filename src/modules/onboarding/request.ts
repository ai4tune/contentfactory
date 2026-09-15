import { isContentChannel } from "@/modules/content/types";
import type { OnboardingAction, OnboardingUpdate } from "./types";

export class OnboardingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingValidationError";
  }
}

export function parseOnboardingUpdate(value: unknown): OnboardingUpdate {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const actions: OnboardingAction[] = ["start", "sync", "complete", "restart"];
  if (!actions.includes(record.action as OnboardingAction)) {
    throw new OnboardingValidationError("建档操作无效。");
  }

  const update: OnboardingUpdate = { action: record.action as OnboardingAction };
  if ("primaryChannel" in record && record.primaryChannel !== undefined && record.primaryChannel !== "") {
    if (!isContentChannel(record.primaryChannel)) {
      throw new OnboardingValidationError("主渠道无效。");
    }
    update.primaryChannel = record.primaryChannel;
  }
  if ("localKnowledgeCount" in record) {
    const count = Number(record.localKnowledgeCount);
    if (!Number.isInteger(count) || count < 0 || count > 100_000) {
      throw new OnboardingValidationError("本地资料数量无效。");
    }
    update.localKnowledgeCount = count;
  }
  return update;
}
