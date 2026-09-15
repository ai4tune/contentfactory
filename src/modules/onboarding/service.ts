import { readStore } from "@/lib/store";
import { listRemoteKnowledgeSources } from "@/modules/knowledge/server/source-store";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getConfirmedStyleProfile } from "@/modules/style-profile/repository";
import {
  getStoredOnboardingStatus,
  replaceStoredOnboardingStatus,
  type StoredOnboardingStatus,
} from "./repository";
import type {
  KnowledgeReadiness,
  OnboardingSnapshot,
  OnboardingStatus,
  OnboardingStepId,
  OnboardingUpdate,
} from "./types";

export class OnboardingCompletionError extends Error {
  missingSteps: OnboardingStepId[];

  constructor(message: string, missingSteps: OnboardingStepId[]) {
    super(message);
    this.name = "OnboardingCompletionError";
    this.missingSteps = missingSteps;
  }
}

export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  const [stored, account, styleProfile, store, remoteSources] = await Promise.all([
    getStoredOnboardingStatus(),
    getCurrentAccountContext(),
    getConfirmedStyleProfile(),
    readStore(),
    listRemoteKnowledgeSources(),
  ]);
  const serverKnowledgeKeys = new Set([
    ...store.materials.map((source) => `${source.source}:${source.id}`),
    ...remoteSources.map((source) => `${source.source}:${source.id}`),
  ]);
  return {
    status: deriveStatus(stored, {
      account,
      styleProfile,
      serverKnowledgeCount: serverKnowledgeKeys.size,
    }),
    account,
    styleProfile,
    serverKnowledgeCount: serverKnowledgeKeys.size,
  };
}

export async function updateOnboardingStatus(update: OnboardingUpdate) {
  const snapshot = await getOnboardingSnapshot();
  const stored = await getStoredOnboardingStatus();
  const now = new Date().toISOString();
  const nextBase: StoredOnboardingStatus = {
    ...stored,
    state: update.action === "restart" || update.action === "start"
      ? "in_progress"
      : stored.state,
    primaryChannel: update.primaryChannel ?? stored.primaryChannel,
    localKnowledgeCount: update.localKnowledgeCount ?? stored.localKnowledgeCount,
    completedAt: update.action === "restart" ? undefined : stored.completedAt,
    updatedAt: now,
  };
  const derived = deriveStatus(nextBase, snapshot);

  if (update.action === "complete") {
    const required: OnboardingStepId[] = ["business", "positioning", "primary_channel"];
    const missingSteps = required.filter((step) => !derived.completedSteps.includes(step));
    if (missingSteps.length) {
      throw new OnboardingCompletionError(
        "请先确认企业业务、账号定位和主渠道，再完成建档。",
        missingSteps,
      );
    }
    const completed = deriveStatus({
      ...nextBase,
      state: "completed",
      completedAt: now,
    }, snapshot);
    await replaceStoredOnboardingStatus({
      ...completed,
      localKnowledgeCount: nextBase.localKnowledgeCount,
    });
    return completed;
  }

  await replaceStoredOnboardingStatus({
    ...derived,
    localKnowledgeCount: nextBase.localKnowledgeCount,
  });
  return derived;
}

function deriveStatus(
  stored: StoredOnboardingStatus,
  snapshot: Pick<OnboardingSnapshot, "account" | "styleProfile" | "serverKnowledgeCount">,
): OnboardingStatus {
  const account = snapshot.account?.status === "confirmed" ? snapshot.account : null;
  const totalKnowledge = stored.localKnowledgeCount + snapshot.serverKnowledgeCount;
  const knowledgeReadiness: KnowledgeReadiness = totalKnowledge >= 5
    ? "ready"
    : totalKnowledge > 0 ? "minimum" : "missing";
  const completedSteps: OnboardingStepId[] = [];

  if (knowledgeReadiness !== "missing") completedSteps.push("knowledge");
  if (
    account?.business.trim()
    && account.offer.trim()
    && account.targetAudience.length
    && account.conversionGoal.trim()
  ) completedSteps.push("business");
  if (account?.accountPosition.trim() && account.contentPillars.length) {
    completedSteps.push("positioning");
  }
  if (snapshot.styleProfile?.status === "confirmed") completedSteps.push("style");
  if (stored.primaryChannel) completedSteps.push("primary_channel");

  const informationGaps: string[] = [];
  if (!completedSteps.includes("knowledge")) {
    informationGaps.push("尚未连接企业资料。生成内容时无法引用产品、案例和 FAQ 中的真实细节。");
  } else if (knowledgeReadiness === "minimum") {
    informationGaps.push("当前资料较少。可以先生成计划，但案例细节和事实表达可能需要更多人工补充。");
  }
  if (!completedSteps.includes("business")) {
    informationGaps.push("企业业务、核心产品、目标客户或经营目标尚未完整确认，内容转化方向会不够明确。");
  }
  if (!completedSteps.includes("positioning")) {
    informationGaps.push("账号定位或内容支柱尚未确认，选题容易发散。");
  }
  if (!completedSteps.includes("style")) {
    informationGaps.push("尚未确认写作风格。系统会先使用账号定位中的品牌语气，成稿可能需要更多口吻调整。");
  }
  if (!completedSteps.includes("primary_channel")) {
    informationGaps.push("尚未确认主渠道，系统无法确定默认内容形式。");
  }
  for (const gap of account?.informationGaps ?? []) {
    if (informationGaps.length >= 12) break;
    informationGaps.push(`账号分析待补充：${gap}`);
  }

  return {
    version: 1,
    state: stored.state,
    completedSteps,
    primaryChannel: stored.primaryChannel,
    knowledgeReadiness,
    informationGaps: [...new Set(informationGaps)],
    completedAt: stored.completedAt,
    updatedAt: stored.updatedAt,
  };
}
