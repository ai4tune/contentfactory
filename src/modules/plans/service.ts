import { randomUUID } from "node:crypto";
import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import {
  contentObjectives,
  contentPlanEvidenceTypes,
  type ContentPillar,
  type ContentPlan,
  type ContentPlanEvidence,
  type ContentPlanGenerationOptions,
  type ContentPlanItem,
  type GeneratedContentPlan,
} from "./types";
import { createContentPlan, replaceContentPlan } from "./repository";

export async function generateNewContentPlan(input: {
  account: AccountContext;
  styleProfileVersion?: number;
  options: ContentPlanGenerationOptions;
}) {
  const generated = await requestPlanFromAi(input.account, input.options);
  const now = new Date().toISOString();
  const pillars = normalizePillars(generated.pillars);
  const items = normalizeItems(generated.items, pillars, [], now);

  return createContentPlan({
    accountContextUpdatedAt: input.account.updatedAt,
    styleProfileVersion: input.styleProfileVersion,
    title: text(generated.title, 200) || `${input.account.accountName || "当前账号"} 30 天内容计划`,
    operatingGoal: input.options.operatingGoal,
    primaryChannel: input.options.primaryChannel,
    targetAudience: input.options.targetAudience,
    pillars,
    publishingFrequency: input.options.publishingFrequency,
    periodStart: input.options.periodStart,
    periodEnd: input.options.periodEnd,
    status: "draft",
    items,
  });
}

export async function regenerateUnlockedPlanItems(input: {
  plan: ContentPlan;
  account: AccountContext;
  styleProfileVersion?: number;
  contextEvidence: ContentPlanEvidence[];
}) {
  if (input.plan.status === "archived") throw new Error("已归档计划不能重新生成。");
  const options: ContentPlanGenerationOptions = {
    operatingGoal: input.plan.operatingGoal,
    primaryChannel: input.plan.primaryChannel,
    targetAudience: input.plan.targetAudience,
    publishingFrequency: input.plan.publishingFrequency,
    periodStart: input.plan.periodStart,
    periodEnd: input.plan.periodEnd,
    contextEvidence: input.contextEvidence,
  };
  const lockedItems = input.plan.items.filter((item) => item.locked);
  const generated = await requestPlanFromAi(input.account, options, {
    pillars: input.plan.pillars,
    lockedItems,
  });
  const now = new Date().toISOString();
  const items = normalizeItems(generated.items, input.plan.pillars, lockedItems, now);
  const updated = await replaceContentPlan({
    ...input.plan,
    accountContextUpdatedAt: input.account.updatedAt,
    styleProfileVersion: input.styleProfileVersion,
    items,
  });
  if (!updated) throw new Error("内容计划不存在。");
  return updated;
}

async function requestPlanFromAi(
  account: AccountContext,
  options: ContentPlanGenerationOptions,
  existing?: { pillars: ContentPillar[]; lockedItems: ContentPlanItem[] },
): Promise<GeneratedContentPlan> {
  const system = [
    "你是企业内容策略规划师。只输出 JSON，不要 Markdown。",
    "输出 title、pillars、items。pillars 必须 3～5 个；items 必须恰好 30 个且标题不重复。",
    "每个 item 必须包含 title、angle、pillarIndex、objective、rationale、evidence。",
    "pillarIndex 从 0 开始；objective 只能是 reach、trust、conversion。",
    "evidence 是数组，每项包含 type、可选 refId、label；type 只能是 enterprise_knowledge、customer_pain、market_signal、inspiration。",
    "不要编造企业事实、案例、客户、数字或市场结果。依据不足时使用 customer_pain 并明确这是待验证的问题判断。",
    "items 按未来 30 天的推荐优先级排序，前 7 个是本周优先选题。",
  ].join("\n");
  const user = [
    "【当前账号】",
    JSON.stringify(account, null, 2),
    "【计划要求】",
    JSON.stringify(options, null, 2),
    existing ? "【已确认内容支柱，不得修改】" : "【内容支柱】请根据账号上下文生成 3～5 个。",
    existing ? JSON.stringify(existing.pillars, null, 2) : "暂无预设。",
    existing?.lockedItems.length ? "【人工编辑或锁定的选题，不得重复、改写或覆盖】" : "【锁定选题】无。",
    existing?.lockedItems.length
      ? JSON.stringify(existing.lockedItems.map((item) => ({ title: item.title, angle: item.angle })), null, 2)
      : "无。",
  ].join("\n");
  const parsed = parseJsonObject(await chatCompletionJson([
    { role: "system", content: system },
    { role: "user", content: user },
  ]));
  const record = asRecord(parsed);
  return {
    title: text(record.title, 200),
    pillars: Array.isArray(record.pillars)
      ? record.pillars.map((value) => {
          const item = asRecord(value);
          return { name: text(item.name, 100), description: text(item.description, 500) };
        })
      : [],
    items: Array.isArray(record.items)
      ? record.items.slice(0, 60).map((value) => normalizeGeneratedItem(value, options.contextEvidence))
      : [],
  };
}

function normalizePillars(value: GeneratedContentPlan["pillars"]): ContentPillar[] {
  const unique = value
    .map((pillar) => ({ name: text(pillar.name, 100), description: text(pillar.description, 500) }))
    .filter((pillar) => pillar.name && pillar.description)
    .filter((pillar, index, all) => all.findIndex((item) => item.name === pillar.name) === index)
    .slice(0, 5);
  if (unique.length < 3) throw new Error("AI 返回的内容支柱不足 3 个，请重试。");
  return unique.map((pillar, index) => ({
    id: `contentPillar_${randomUUID()}`,
    ...pillar,
    priority: index + 1,
  }));
}

function normalizeItems(
  generated: GeneratedContentPlan["items"],
  pillars: ContentPillar[],
  lockedItems: ContentPlanItem[],
  now: string,
): ContentPlanItem[] {
  if (lockedItems.length > 30) throw new Error("锁定选题不能超过 30 个。");
  const lockedTitles = new Set(lockedItems.map((item) => normalizeTitle(item.title)));
  const uniqueGenerated = generated
    .filter((item) => item.title && item.rationale)
    .filter((item) => !lockedTitles.has(normalizeTitle(item.title)))
    .filter((item, index, all) => all.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(item.title)) === index);
  const needed = 30 - lockedItems.length;
  if (uniqueGenerated.length < needed) {
    throw new Error(`AI 只返回 ${uniqueGenerated.length} 个可用且不重复的选题，需要 ${needed} 个，请重试。`);
  }

  const weekCounts = [0, 0, 0, 0];
  const usedPriorities = new Set<number>();
  for (const item of lockedItems) {
    if (item.week >= 1 && item.week <= 4) weekCounts[item.week - 1] += 1;
    usedPriorities.add(item.priority);
  }
  const availablePriorities = Array.from({ length: 30 }, (_, index) => index + 1)
    .filter((priority) => !usedPriorities.has(priority));

  const freshItems = uniqueGenerated.slice(0, needed).map((item, index): ContentPlanItem => {
    const pillar = pillars[item.pillarIndex] ?? pillars[index % pillars.length];
    const evidence = item.evidence.length
      ? item.evidence
      : [{ type: "customer_pain" as const, label: `${item.rationale}（待验证）` }];
    return {
      id: `contentPlanItem_${randomUUID()}`,
      title: item.title,
      angle: item.angle || undefined,
      pillarId: pillar.id,
      objective: contentObjectives.includes(item.objective) ? item.objective : contentObjectives[index % contentObjectives.length],
      rationale: item.rationale,
      evidence,
      week: allocateWeek(weekCounts),
      priority: availablePriorities[index],
      locked: false,
      origin: "ai",
      status: "pending",
      updatedAt: now,
    };
  });

  return [...lockedItems, ...freshItems].sort((left, right) => left.priority - right.priority);
}

function normalizeGeneratedItem(
  value: unknown,
  allowedEvidence: ContentPlanEvidence[],
): GeneratedContentPlan["items"][number] {
  const record = asRecord(value);
  const allowedRefs = new Set(
    allowedEvidence
      .filter((item) => item.refId)
      .map((item) => `${item.type}:${item.refId}`),
  );
  const evidence = Array.isArray(record.evidence)
    ? record.evidence.slice(0, 20).flatMap((entry) => {
        const item = asRecord(entry);
        if (!contentPlanEvidenceTypes.includes(item.type as ContentPlanEvidence["type"])) return [];
        const label = text(item.label, 1000);
        if (!label) return [];
        const refId = text(item.refId, 500) || undefined;
        if (item.type !== "customer_pain" && (!refId || !allowedRefs.has(`${item.type}:${refId}`))) {
          return [];
        }
        return [{
          type: item.type as ContentPlanEvidence["type"],
          refId,
          label,
        }];
      })
    : [];
  return {
    title: text(record.title, 300),
    angle: text(record.angle, 500) || undefined,
    pillarIndex: Number.isInteger(Number(record.pillarIndex)) ? Number(record.pillarIndex) : 0,
    objective: contentObjectives.includes(record.objective as GeneratedContentPlan["items"][number]["objective"])
      ? record.objective as GeneratedContentPlan["items"][number]["objective"]
      : "trust",
    rationale: text(record.rationale, 1000),
    evidence,
  };
}

function allocateWeek(counts: number[]) {
  const capacities = [7, 7, 7, 9];
  const index = counts.findIndex((count, week) => count < capacities[week]);
  const selected = index >= 0 ? index : 3;
  counts[selected] += 1;
  return selected + 1;
}

function normalizeTitle(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}
