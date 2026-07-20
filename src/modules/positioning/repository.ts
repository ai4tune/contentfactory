import type { PositioningRequest, PositioningResult } from "@/lib/ai";
import { readStore, updateStore, type StoredRecord } from "@/lib/store";
import { createAccountContextDraft, type AccountContext, type AccountContextDraft } from "./types";

export async function getCurrentAccountContext(): Promise<AccountContext | null> {
  const store = await readStore();

  if (store.accountContext) {
    return store.accountContext;
  }

  const legacyProfile = store.accountProfiles.at(-1);
  return legacyProfile ? migrateLegacyProfile(legacyProfile) : null;
}

export async function confirmAccountContext(draft: AccountContextDraft): Promise<AccountContext> {
  const now = new Date().toISOString();
  const context: AccountContext = {
    ...withoutInput(draft),
    id: "current-account",
    status: "confirmed",
    confirmedAt: now,
    updatedAt: now,
  };

  await updateStore((store) => ({ ...store, accountContext: context }));
  return context;
}

export async function skipAccountContext(): Promise<AccountContext> {
  const current = await getCurrentAccountContext();
  const now = new Date().toISOString();
  const context: AccountContext = {
    id: "current-account",
    status: "skipped",
    source: current?.source ?? "manual",
    accountName: current?.accountName ?? "",
    business: current?.business ?? "",
    platforms: current?.platforms ?? [],
    accountPosition: current?.accountPosition ?? "",
    targetAudience: current?.targetAudience ?? [],
    offer: current?.offer ?? "",
    conversionGoal: current?.conversionGoal ?? "",
    contentPillars: current?.contentPillars ?? [],
    brandVoice: current?.brandVoice ?? [],
    preferredPhrases: current?.preferredPhrases ?? [],
    bannedPhrases: current?.bannedPhrases ?? [],
    contentDirections: current?.contentDirections ?? [],
    recommendedTopics: current?.recommendedTopics ?? [],
    analysisEvidence: current?.analysisEvidence ?? [],
    informationGaps: current?.informationGaps ?? [],
    updatedAt: now,
  };

  await updateStore((store) => ({ ...store, accountContext: context }));
  return context;
}

function withoutInput({ input, ...draft }: AccountContextDraft) {
  void input;
  return draft;
}

function migrateLegacyProfile(
  profile: StoredRecord<PositioningRequest, PositioningResult>,
): AccountContext {
  const draft = createAccountContextDraft(profile.input, profile.result);

  return {
    ...withoutInput(draft),
    id: "current-account",
    status: "confirmed",
    confirmedAt: profile.createdAt,
    updatedAt: profile.createdAt,
  };
}
