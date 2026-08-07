import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { StyleProfile, StyleProfileInput, StyleProfileStatus } from "./types";

type StyleProfileStore = {
  confirmedProfile?: StyleProfile | null;
  draftProfile?: StyleProfile | null;
  profile?: StyleProfile | null;
};

const styleProfileStorePath = path.join(process.cwd(), "data", "style-profiles.local.json");
const emptyStore: StyleProfileStore = { confirmedProfile: null, draftProfile: null };

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
) {
  const updated = await updateJsonFile<StyleProfileStore>(styleProfileStorePath, emptyStore, (store) => {
    const now = new Date().toISOString();
    const confirmedProfile = store.confirmedProfile
      ?? (store.profile?.status === "confirmed" ? store.profile : null);
    const current = store.draftProfile ?? confirmedProfile ?? store.profile;
    const profile: StyleProfile = {
      ...input,
      id: "current-style-profile",
      accountId: "current-account",
      status,
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      confirmedAt: status === "confirmed" ? now : undefined,
    };
    return status === "confirmed"
      ? { confirmedProfile: profile, draftProfile: null }
      : { confirmedProfile, draftProfile: profile };
  });

  return status === "confirmed" ? updated.confirmedProfile! : updated.draftProfile!;
}
