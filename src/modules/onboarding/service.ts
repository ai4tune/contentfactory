import { readStore } from "@/lib/store";
import { listRemoteKnowledgeSources } from "@/modules/knowledge/server/source-store";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";
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
  const [stored, account, styleProfile, knowledgeProfile, store, remoteSources] = await Promise.all([
    getStoredOnboardingStatus(),
    getCurrentAccountContext(),
    getConfirmedStyleProfile(),
    getConfirmedKnowledgeProfile(),
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
      knowledgeProfileConfirmed: Boolean(knowledgeProfile),
      businessProfile: knowledgeProfile,
    }),
    account,
    styleProfile,
    serverKnowledgeCount: serverKnowledgeKeys.size,
    knowledgeProfileConfirmed: Boolean(knowledgeProfile),
    businessProfile: knowledgeProfile,
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
    const required: OnboardingStepId[] = ["business", "primary_channel"];
    const missingSteps = required.filter((step) => !derived.completedSteps.includes(step));
    if (missingSteps.length) {
      throw new OnboardingCompletionError(
        "请先确认真实业务信息并选择主渠道；账号定位可以稍后确定。",
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
  snapshot: Pick<OnboardingSnapshot, "account" | "styleProfile" | "serverKnowledgeCount" | "knowledgeProfileConfirmed" | "businessProfile">,
): OnboardingStatus {
  const account = snapshot.account?.status === "confirmed" ? snapshot.account : null;
  const totalKnowledge = stored.localKnowledgeCount + snapshot.serverKnowledgeCount;
  const knowledgeReadiness: KnowledgeReadiness = snapshot.knowledgeProfileConfirmed
    ? "ready"
    : totalKnowledge > 0 ? "minimum" : "missing";
  const completedSteps: OnboardingStepId[] = [];

  if (knowledgeReadiness !== "missing") completedSteps.push("knowledge");
  if (account?.business.trim() || snapshot.businessProfile?.businessSummary.trim()) completedSteps.push("business");
  if (account?.accountPosition.trim() && account.contentPillars.length) {
    completedSteps.push("positioning");
  }
  if (snapshot.styleProfile?.status === "confirmed") completedSteps.push("style");
  if (stored.primaryChannel) completedSteps.push("primary_channel");

  const informationGaps: string[] = [];
  if (!completedSteps.includes("knowledge")) {
    informationGaps.push("尚未连接企业资料。生成内容时无法引用产品、案例和 FAQ 中的真实细节。");
  } else if (knowledgeReadiness === "minimum") {
    informationGaps.push("资料已连接，但还没有生成并确认企业知识档案。请先在知识库检查扫描结果，再带入账号定位。");
  }
  if (!completedSteps.includes("business")) {
    informationGaps.push("尚未确认真实业务信息。先告诉我们做什么生意，目标和客群可以稍后补充。");
  }
  if (!completedSteps.includes("positioning")) {
    informationGaps.push("账号方向尚未确认，可以先介绍真实业务，再根据使用和调研逐步确定。");
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
