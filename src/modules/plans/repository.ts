import { randomUUID } from "node:crypto";
import { daysBetween } from "./calendar";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { dataFilePath } from "@/lib/data-directory";
import type {
  ContentPlan,
  ContentPlanItem,
  ContentPlanItemStatus,
} from "./types";

type ContentPlanStore = {
  schemaVersion: 1;
  plans: ContentPlan[];
};

const storePath = dataFilePath("content-plans.local.json");
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
    ...store,
    schemaVersion: 1,
    plans: [plan, ...(store.plans ?? [])],
  }));
  return plan;
}

export class PlanConflictError extends Error {
  constructor() { super("计划在生成期间已被调整，结果没有覆盖新安排，请刷新后重试。"); this.name = "PlanConflictError"; }
}

export async function replaceContentPlan(plan: ContentPlan): Promise<ContentPlan | null> {
  return mutateContentPlan(plan.id, (current) => {
    if (current.updatedAt !== plan.updatedAt) throw new PlanConflictError();
    return { ...plan, schemaVersion: 1, createdAt: current.createdAt };
  });
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
    | "timeZone"
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

export async function addPlanTask(planId: string, input: Pick<ContentPlanItem, "taskType" | "title" | "rationale" | "scheduledDate">) {
  return mutateContentPlan(planId, (current) => ({
    ...current,
    items: [...current.items, {
      ...input,
      id: `contentPlanItem_${randomUUID()}`,
      pillarId: current.pillars[0].id,
      objective: "trust",
      evidence: [],
      week: Math.floor(daysBetween(current.periodStart, input.scheduledDate!) / 7) + 1,
      priority: Math.max(0, ...current.items.map((item) => item.priority)) + 1,
      locked: true,
      origin: "manual",
      status: "pending",
      updatedAt: new Date().toISOString(),
    }],
  }));
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

export async function markPlanItemPublished(
  planId: string,
  itemId: string,
  contentProjectId: string,
  publicationId: string,
): Promise<ContentPlan | null> {
  return updatePlanItemProgress(planId, itemId, {
    contentProjectId,
    publicationId,
    status: "published",
  });
}

export async function markPlanItemsReviewed(
  planId: string,
  publications: Array<{ itemId: string; publicationId: string }>,
): Promise<ContentPlan | null> {
  const publicationByItem = new Map(publications.map((item) => [item.itemId, item.publicationId]));
  const now = new Date().toISOString();
  return mutateContentPlan(planId, (current) => ({
    ...current,
    items: current.items.map((item) => {
      const publicationId = publicationByItem.get(item.id);
      return publicationId
        ? { ...item, publicationId, status: "reviewed" as const, updatedAt: now }
        : item;
    }),
  }));
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
      ? { ...item, ...update, status: item.status === "paused" ? "paused" as const : update.status, updatedAt: now }
      : item);
    return { ...current, items };
  });
}

async function updatePlanItemProgress(
  planId: string,
  itemId: string,
  update: {
    contentProjectId: string;
    publicationId: string;
    status: ContentPlanItemStatus;
  },
) {
  const now = new Date().toISOString();
  return mutateContentPlan(planId, (current) => {
    if (!current.items.some((item) => item.id === itemId)) return null;
    return {
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? { ...item, ...update, updatedAt: now }
        : item),
    };
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
    ...store,
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
