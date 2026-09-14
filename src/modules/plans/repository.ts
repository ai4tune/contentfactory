import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type {
  ContentPlan,
  ContentPlanItem,
  ContentPlanItemStatus,
} from "./types";

type ContentPlanStore = {
  schemaVersion: 1;
  plans: ContentPlan[];
};

const storePath = path.join(process.cwd(), "data", "content-plans.local.json");
const emptyStore: ContentPlanStore = { schemaVersion: 1, plans: [] };

export async function listContentPlans(): Promise<ContentPlan[]> {
  const store = await readJsonFile<ContentPlanStore>(storePath, emptyStore);
  return (store.plans ?? []).slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getCurrentContentPlan(): Promise<ContentPlan | null> {
  const plans = await listContentPlans();
  return plans.find((plan) => plan.status !== "archived") ?? null;
}

export async function getContentPlan(planId: string): Promise<ContentPlan | null> {
  const plans = await listContentPlans();
  return plans.find((plan) => plan.id === planId) ?? null;
}

export async function createContentPlan(
  input: Omit<ContentPlan, "id" | "schemaVersion" | "createdAt" | "updatedAt">,
): Promise<ContentPlan> {
  const now = new Date().toISOString();
  const plan: ContentPlan = {
    ...input,
    id: `contentPlan_${randomUUID()}`,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  await updateJsonFile<ContentPlanStore>(storePath, emptyStore, (store) => ({
    schemaVersion: 1,
    plans: [plan, ...(store.plans ?? [])],
  }));
  return plan;
}

export async function replaceContentPlan(plan: ContentPlan): Promise<ContentPlan | null> {
  return mutateContentPlan(plan.id, (current) => ({
    ...plan,
    schemaVersion: 1,
    createdAt: current.createdAt,
  }));
}

export async function updateContentPlan(
  planId: string,
  update: Partial<Pick<
    ContentPlan,
    | "title"
    | "operatingGoal"
    | "primaryChannel"
    | "targetAudience"
    | "pillars"
    | "publishingFrequency"
    | "periodStart"
    | "periodEnd"
    | "status"
  >>,
): Promise<ContentPlan | null> {
  return mutateContentPlan(planId, (current) => ({ ...current, ...update }));
}

export async function updateContentPlanItem(
  planId: string,
  itemId: string,
  update: Partial<Pick<
    ContentPlanItem,
    | "title"
    | "angle"
    | "pillarId"
    | "objective"
    | "rationale"
    | "evidence"
    | "week"
    | "scheduledDate"
    | "priority"
    | "locked"
    | "status"
  >>,
  options: { humanEdit?: boolean } = {},
): Promise<ContentPlan | null> {
  const now = new Date().toISOString();
  return mutateContentPlan(planId, (current) => {
    if (!current.items.some((item) => item.id === itemId)) return null;
    const items = current.items.map((item) => {
      if (item.id !== itemId) return item;
      const humanFieldsChanged = options.humanEdit && hasEditorialChanges(item, update);
      return {
        ...item,
        ...update,
        locked: update.locked ?? (humanFieldsChanged ? true : item.locked),
        origin: humanFieldsChanged ? "manual" as const : item.origin,
        editedAt: humanFieldsChanged ? now : item.editedAt,
        updatedAt: now,
      };
    });
    return { ...current, items };
  });
}

export async function linkContentProjectToPlanItem(
  planId: string,
  itemId: string,
  contentProjectId: string,
): Promise<ContentPlan | null> {
  return updatePlanItemSystemFields(planId, itemId, {
    contentProjectId,
    status: "writing",
  });
}

export async function markPlanItemGenerated(
  planId: string,
  itemId: string,
  contentProjectId: string,
): Promise<ContentPlan | null> {
  return updatePlanItemSystemFields(planId, itemId, {
    contentProjectId,
    status: "generated",
  });
}

async function updatePlanItemSystemFields(
  planId: string,
  itemId: string,
  update: { contentProjectId: string; status: ContentPlanItemStatus },
) {
  const now = new Date().toISOString();
  return mutateContentPlan(planId, (current) => {
    if (!current.items.some((item) => item.id === itemId)) return null;
    const items = current.items.map((item) => item.id === itemId
      ? { ...item, ...update, updatedAt: now }
      : item);
    return { ...current, items };
  });
}

function hasEditorialChanges(
  current: ContentPlanItem,
  update: Partial<ContentPlanItem>,
) {
  const editorialFields: Array<keyof ContentPlanItem> = [
    "title",
    "angle",
    "pillarId",
    "objective",
    "rationale",
    "evidence",
    "week",
    "scheduledDate",
    "priority",
  ];
  return editorialFields.some((field) => field in update && JSON.stringify(update[field]) !== JSON.stringify(current[field]));
}

async function mutateContentPlan(
  planId: string,
  mutate: (current: ContentPlan) => ContentPlan | null,
): Promise<ContentPlan | null> {
  let updated: ContentPlan | null = null;
  await updateJsonFile<ContentPlanStore>(storePath, emptyStore, (store) => ({
    schemaVersion: 1,
    plans: (store.plans ?? []).map((current) => {
      if (current.id !== planId) return current;
      const next = mutate(current);
      if (!next) return current;
      updated = {
        ...next,
        schemaVersion: 1,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    }),
  }));
  return updated;
}
