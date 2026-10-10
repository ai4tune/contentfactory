import { randomUUID } from "node:crypto";
import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import { formatKnowledgeProfileForPrompt } from "@/modules/knowledge-profile/service";
import type { EnterpriseKnowledgeProfile } from "@/modules/knowledge-profile/types";
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
import { daysBetween, defaultTimeZone, itemDate, localDate, publishingDates } from "./calendar";

export async function generateNewContentPlan(input: {
  account: AccountContext;
  styleProfileVersion?: number;
  knowledgeProfile?: EnterpriseKnowledgeProfile | null;
  options: ContentPlanGenerationOptions;
}) {
  const generated = await requestPlanFromAi(input.account, input.options, input.knowledgeProfile);
  const now = new Date().toISOString();
  const items = normalizeItems(generated.items, generated.pillars, [], now, input.options, publishingDates(input.options.periodStart, input.options.periodEnd, input.options.publishingFrequency));

  return createContentPlan({
    accountContextUpdatedAt: input.account.updatedAt,
    styleProfileVersion: input.styleProfileVersion,
    enterpriseKnowledgeProfileVersion: input.knowledgeProfile?.version,
    title: `${input.account.accountName || "当前账号"} ${daysBetween(input.options.periodStart, input.options.periodEnd) + 1} 天内容计划`,
    operatingGoal: input.options.operatingGoal,
    primaryChannel: input.options.primaryChannel,
    targetAudience: input.options.targetAudience,
    pillars: generated.pillars,
    publishingFrequency: input.options.publishingFrequency,
    periodStart: input.options.periodStart,
    periodEnd: input.options.periodEnd,
    timeZone: input.options.timeZone,
    status: "draft",
    items,
  });
}

export async function regenerateUnlockedPlanItems(input: {
  plan: ContentPlan;
  account: AccountContext;
  styleProfileVersion?: number;
  knowledgeProfile?: EnterpriseKnowledgeProfile | null;
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
    timeZone: input.plan.timeZone || defaultTimeZone,
    contextEvidence: input.contextEvidence,
  };
  const today = localDate(new Date(), options.timeZone);
  const lockedItems = input.plan.items.filter((item) => item.locked || item.status !== "pending" || item.contentProjectId || item.publicationId || (item.taskType ?? "content") !== "content" || itemDate(input.plan, item) < today);
  const remainingDates = publishingDates(options.periodStart, options.periodEnd, options.publishingFrequency).filter((date) => date >= today);
  for (const item of lockedItems.filter((item) => (item.taskType ?? "content") === "content")) {
    const index = remainingDates.indexOf(itemDate(input.plan, item));
    if (index >= 0) remainingDates.splice(index, 1);
  }
  if (!remainingDates.length) return input.plan;
  const generated = await requestPlanFromAi(input.account, options, input.knowledgeProfile, {
    pillars: input.plan.pillars,
    lockedItems, dates: remainingDates,
  });
  const now = new Date().toISOString();
  const items = normalizeItems(generated.items, input.plan.pillars, lockedItems, now, options, remainingDates);
  const updated = await replaceContentPlan({
    ...input.plan,
    accountContextUpdatedAt: input.account.updatedAt,
    styleProfileVersion: input.styleProfileVersion,
    enterpriseKnowledgeProfileVersion: input.knowledgeProfile?.version,
    items,
  });
  if (!updated) throw new Error("内容计划不存在。");
  return updated;
}

async function requestPlanFromAi(
  account: AccountContext,
  options: ContentPlanGenerationOptions,
  knowledgeProfile?: EnterpriseKnowledgeProfile | null,
  existing?: { pillars: ContentPillar[]; lockedItems: ContentPlanItem[]; dates: string[] },
): Promise<{ title: string; pillars: ContentPillar[]; items: GeneratedContentPlan["items"] }> {
  const needed = existing?.dates.length ?? publishingDates(options.periodStart, options.periodEnd, options.publishingFrequency).length;
  const items: GeneratedContentPlan["items"] = [];
  const usedTitles = new Set(existing?.lockedItems.map((item) => normalizeTitle(item.title)) ?? []);
  let pillars = existing?.pillars;
  let title = "";

  for (let batchNumber = 1; batchNumber <= Math.ceil(needed / 10) + 1 && items.length < needed; batchNumber++) {
    const count = Math.min(10, needed - items.length);
    const batch = await requestPlanBatch(account, options, knowledgeProfile, pillars, existing?.lockedItems ?? [], {
      count,
      start: items.length + 1,
      excludedTitles: [
        ...(existing?.lockedItems.map((item) => item.title) ?? []),
        ...items.map((item) => item.title),
      ],
    });
    if (!pillars) pillars = normalizePillars(batch.pillars, account.contentPillars);
    if (!title) title = batch.title;
    const before = items.length;
    for (const item of batch.items) {
      const key = normalizeTitle(item.title);
      if (!key || !item.rationale || usedTitles.has(key)) continue;
      items.push(item);
      usedTitles.add(key);
      if (items.length - before === count) break;
    }
    console.info("[content-plan] AI batch completed", { batchNumber, requested: count, accepted: items.length - before });
  }

  return { title, pillars: pillars ?? normalizePillars([], account.contentPillars), items };
}

async function requestPlanBatch(
  account: AccountContext,
  options: ContentPlanGenerationOptions,
  knowledgeProfile: EnterpriseKnowledgeProfile | null | undefined,
  pillars: ContentPillar[] | undefined,
  lockedItems: ContentPlanItem[],
  batch: { count: number; start: number; excludedTitles: string[] },
): Promise<GeneratedContentPlan> {
  const system = [
    "你是企业内容策略规划师。只输出 JSON，不要 Markdown。",
    pillars ? "只输出 items；使用已确认内容支柱，不要新增或修改支柱。" : "输出 title、pillars、items；pillars 必须 3～5 个，每个包含 name 和 description。",
    `items 本批必须恰好 ${batch.count} 个且标题不重复。`,
    "每个 item 必须包含 title、angle、pillarIndex、objective、rationale、evidence。",
    "pillarIndex 从 0 开始；objective 只能是 reach、trust、conversion。",
    "evidence 是数组，每项包含 type、可选 refId、label；type 只能是 enterprise_knowledge、customer_pain、market_signal、inspiration。",
    "不要编造企业事实、案例、客户、数字或市场结果。依据不足时使用 customer_pain 并明确这是待验证的问题判断。",
    `items 按 ${options.periodStart} 至 ${options.periodEnd} 的执行顺序排列；每周 ${options.publishingFrequency} 篇，本批只生成要求的数量，日期由系统安排。`,
  ].join("\n");
  const user = [
    "【当前账号】",
    JSON.stringify(account, null, 2),
    "【计划要求】",
    JSON.stringify(options, null, 2),
    "【已确认企业知识档案】",
    formatKnowledgeProfileForPrompt(knowledgeProfile ?? null),
    pillars ? "【已确认内容支柱，不得修改；pillarIndex 按此数组从 0 开始】" : "【内容支柱】请根据账号上下文生成 3～5 个。",
    pillars ? JSON.stringify(pillars.map(({ name, description }) => ({ name, description })), null, 2) : "暂无预设。",
    `【本批次】只生成第 ${batch.start}～${batch.start + batch.count - 1} 个新选题；前批次已经生成的标题不得重复。`,
    batch.excludedTitles.length ? "【不得重复的已有标题】" : "【已有标题】无。",
    batch.excludedTitles.length ? JSON.stringify(batch.excludedTitles) : "无。",
    lockedItems.length ? "【人工编辑或锁定的选题，不得重复、改写或覆盖】" : "【锁定选题】无。",
    lockedItems.length
      ? JSON.stringify(lockedItems.map((item) => ({ title: item.title, angle: item.angle })), null, 2)
      : "无。",
  ].join("\n");
  const parsed = parseJsonObject(await chatCompletionJson([
    { role: "system", content: system },
    { role: "user", content: user },
  ], { minimumTimeoutMs: 180_000 }));
  const record = asRecord(parsed);
  return {
    title: text(record.title, 200),
    pillars: Array.isArray(record.pillars)
      ? record.pillars.map((value) => {
          const item = asRecord(value);
          return {
            name: text(typeof value === "string" ? value : item.name ?? item.title, 100),
            description: text(item.description ?? item.summary, 500),
          };
        })
      : [],
    items: Array.isArray(record.items)
      ? record.items.slice(0, 20).map((value) => normalizeGeneratedItem(value, [
          ...options.contextEvidence,
          ...(knowledgeProfile?.facts
            .filter((fact) => fact.confidence === "confirmed")
            .map((fact) => ({ type: "enterprise_knowledge" as const, refId: fact.id, label: fact.statement })) ?? []),
        ]))
      : [],
  };
}

function normalizePillars(value: GeneratedContentPlan["pillars"], accountPillars: string[]): ContentPillar[] {
  const unique = value
    .map((pillar) => ({ name: text(pillar.name, 100), description: text(pillar.description, 500) }))
    .filter((pillar) => pillar.name)
    .filter((pillar, index, all) => all.findIndex((item) => normalizeTitle(item.name) === normalizeTitle(pillar.name)) === index)
    .slice(0, 5);
  if (unique.length < 3) {
    for (const value of accountPillars) {
      const name = text(value, 100);
      if (name && !unique.some((pillar) => normalizeTitle(pillar.name) === normalizeTitle(name))) {
        unique.push({ name, description: "" });
      }
      if (unique.length === 5) break;
    }
  }
  if (unique.length < 3) throw new Error("内容支柱不足 3 个，请先在当前账号补充至少 3 个内容方向后再生成。");
  return unique.map((pillar, index) => ({
    id: `contentPillar_${randomUUID()}`,
    name: pillar.name,
    description: pillar.description || `围绕「${pillar.name}」策划内容，具体观点和案例以已确认资料为准。`,
    priority: index + 1,
  }));
}

function normalizeItems(
  generated: GeneratedContentPlan["items"],
  pillars: ContentPillar[],
  preservedItems: ContentPlanItem[],
  now: string,
  options: ContentPlanGenerationOptions,
  dates: string[],
): ContentPlanItem[] {
  const preservedTitles = new Set(preservedItems.map((item) => normalizeTitle(item.title)));
  const uniqueGenerated = generated
    .filter((item) => item.title && item.rationale && !preservedTitles.has(normalizeTitle(item.title)))
    .filter((item, index, all) => all.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(item.title)) === index);
  if (uniqueGenerated.length < dates.length) throw new Error(`AI 只返回 ${uniqueGenerated.length} 个可用且不重复的选题，需要 ${dates.length} 个，请重试。`);
  const firstPriority = Math.max(0, ...preservedItems.map((item) => item.priority)) + 1;
  const freshItems = uniqueGenerated.slice(0, dates.length).map((item, index): ContentPlanItem => ({
    id: `contentPlanItem_${randomUUID()}`,
    taskType: "content",
    title: item.title,
    angle: item.angle || undefined,
    pillarId: (pillars[item.pillarIndex] ?? pillars[index % pillars.length]).id,
    objective: contentObjectives.includes(item.objective) ? item.objective : "trust",
    rationale: item.rationale,
    evidence: item.evidence.length ? item.evidence : [{ type: "customer_pain", label: `${item.rationale}（待验证）` }],
    week: Math.floor(daysBetween(options.periodStart, dates[index]) / 7) + 1,
    scheduledDate: dates[index],
    priority: firstPriority + index,
    locked: false,
    origin: "ai",
    status: "pending",
    updatedAt: now,
  }));
  return [...preservedItems, ...freshItems].sort((left, right) => left.priority - right.priority);
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
