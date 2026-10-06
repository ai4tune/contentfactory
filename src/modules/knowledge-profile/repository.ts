import { randomUUID } from "node:crypto";
import { dataFilePath } from "@/lib/data-directory";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type {
  EnterpriseKnowledgeProfile,
  EnterpriseKnowledgeProfileInput,
  KnowledgeProfileStatus,
} from "./types";

type KnowledgeProfileStore = {
  schemaVersion: 1;
  profiles: EnterpriseKnowledgeProfile[];
};

const storePath = dataFilePath("enterprise-knowledge-profiles.local.json");
const emptyStore: KnowledgeProfileStore = { schemaVersion: 1, profiles: [] };

export async function listKnowledgeProfiles() {
  const store = await readJsonFile<KnowledgeProfileStore>(storePath, emptyStore);
  return (store.profiles ?? []).slice().sort((left, right) => right.version - left.version);
}

export async function getKnowledgeProfileState() {
  const profiles = await listKnowledgeProfiles();
  return {
    draft: profiles.find((profile) => profile.status === "draft") ?? null,
    confirmed: profiles.find((profile) => profile.status === "confirmed") ?? null,
    history: profiles.filter((profile) => profile.status === "archived"),
  };
}

export async function getConfirmedKnowledgeProfile() {
  return (await getKnowledgeProfileState()).confirmed;
}

export async function saveKnowledgeProfile(
  input: EnterpriseKnowledgeProfileInput,
  status: Exclude<KnowledgeProfileStatus, "archived">,
  idempotencyId?: string,
) {
  validateForPersistence(input, status);
  let saved: EnterpriseKnowledgeProfile | null = null;
  await updateJsonFile<KnowledgeProfileStore>(storePath, emptyStore, (store) => {
    const now = new Date().toISOString();
    const profiles = store.profiles ?? [];
    const existing = idempotencyId && profiles.find((profile) => profile.id === idempotencyId);
    if (existing) { saved = existing; return store; }
    const currentDraft = profiles.find((profile) => profile.status === "draft");
    const maxVersion = profiles.reduce((max, profile) => Math.max(max, profile.version), 0);
    const profile: EnterpriseKnowledgeProfile = {
      ...input,
      id: idempotencyId ?? currentDraft?.id ?? `knowledgeProfile_${randomUUID()}`,
      schemaVersion: 1,
      status,
      version: currentDraft?.version ?? maxVersion + 1,
      createdAt: currentDraft?.createdAt ?? now,
      updatedAt: now,
      confirmedAt: status === "confirmed" ? now : undefined,
    };
    saved = profile;
    const next = profiles
      .filter((item) => item.id !== currentDraft?.id)
      .map((item) => status === "confirmed" && item.status === "confirmed"
        ? { ...item, status: "archived" as const, updatedAt: now }
        : item);
    return { schemaVersion: 1, profiles: [profile, ...next] };
  });
  return saved!;
}

function validateForPersistence(
  input: EnterpriseKnowledgeProfileInput,
  status: Exclude<KnowledgeProfileStatus, "archived">,
) {
  if (!input.name.trim() || !input.businessSummary.trim()) {
    throw new Error("请补充档案名称和业务概述。");
  }
  if (!input.sources.length) throw new Error("企业知识档案必须保留至少一个来源。");
  if (status !== "confirmed") return;
  const sourceIds = new Set(input.sources.map((source) => source.id));
  const invalidFacts = input.facts.filter((fact) =>
    fact.confidence === "confirmed"
    && (!fact.sourceIds.length || fact.sourceIds.some((sourceId) => !sourceIds.has(sourceId))),
  );
  if (invalidFacts.length) {
    throw new Error(`有 ${invalidFacts.length} 条已确认事实缺少有效来源，请补充引用或标记为待确认。`);
  }
}
