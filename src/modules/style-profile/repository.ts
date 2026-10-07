import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { dataFilePath } from "@/lib/data-directory";
import type { StyleProfile, StyleProfileInput, StyleProfileStatus } from "./types";

type StyleProfileStore = {
  confirmedProfile?: StyleProfile | null;
  draftProfile?: StyleProfile | null;
  profile?: StyleProfile | null;
};

const styleProfileStorePath = dataFilePath("style-profiles.local.json");
const emptyStore: StyleProfileStore = { confirmedProfile: null, draftProfile: null };

export class StyleVersionError extends Error {
  readonly status = 409;
  constructor() { super("风格已在其他页面更新，请刷新后再确认。"); }
}

export async function getCurrentStyleProfile() {
  const store = await readJsonFile<StyleProfileStore>(styleProfileStorePath, emptyStore);
  return store.draftProfile ?? store.confirmedProfile ?? store.profile ?? null;
}

export async function getConfirmedStyleProfile() {
  const store = await readJsonFile<StyleProfileStore>(styleProfileStorePath, emptyStore);
  const profile = store.confirmedProfile ?? store.profile;
  return profile?.status === "confirmed" ? profile : null;
}

export async function saveCurrentStyleProfile(
  input: StyleProfileInput,
  status: StyleProfileStatus,
  expectedVersion?: number,
) {
  const updated = await updateJsonFile<StyleProfileStore>(styleProfileStorePath, emptyStore, (store) => {
    const now = new Date().toISOString();
    const confirmedProfile = store.confirmedProfile
      ?? (store.profile?.status === "confirmed" ? store.profile : null);
    const current = store.draftProfile ?? confirmedProfile ?? store.profile;
    if (expectedVersion !== undefined && (current?.version ?? 0) !== expectedVersion) throw new StyleVersionError();
    const profile: StyleProfile = {
      ...current, ...input,
      id: "current-style-profile",
      accountId: "current-account",
      status,
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      confirmedAt: status === "confirmed" ? now : undefined,
    };
    return status === "confirmed"
      ? { ...store, confirmedProfile: profile, draftProfile: null }
      : { ...store, confirmedProfile, draftProfile: profile };
  });

  return status === "confirmed" ? updated.confirmedProfile! : updated.draftProfile!;
}
