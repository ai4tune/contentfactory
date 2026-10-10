import { isContentChannel, type ContentChannel } from "@/modules/content/types";
import type { AccountContext } from "@/modules/positioning/types";
import { addDays, daysBetween, defaultTimeZone, localDate } from "./calendar";
import {
  contentObjectives,
  contentPlanEvidenceTypes,
  contentPlanItemStatuses,
  contentPlanStatuses,
  planTaskTypes,
  type ContentPillar,
  type ContentPlan,
  type ContentPlanEvidence,
  type ContentPlanGenerationOptions,
  type ContentPlanItem,
} from "./types";

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export function parsePlanGenerationOptions(
  value: unknown,
  account: AccountContext,
): ContentPlanGenerationOptions {
  const record = asRecord(value);
  const timeZone = requiredTimeZone(record.timeZone ?? defaultTimeZone);
  const periodDays = record.periodDays ?? 7;
  if (periodDays !== 7 && periodDays !== 30) throw new PlanValidationError("请选择 7 天或 30 天计划。");
  const periodStart = "periodStart" in record ? requiredDate(record.periodStart, "开始日期") : localDate(new Date(), timeZone);
  const periodEnd = "periodEnd" in record ? requiredDate(record.periodEnd, "结束日期") : addDays(periodStart, periodDays - 1);
  if (periodEnd < periodStart) throw new PlanValidationError("计划结束日期不能早于开始日期。");
  if (![7, 30].includes(daysBetween(periodStart, periodEnd) + 1)) throw new PlanValidationError("新计划的周期必须是 7 天或 30 天。");

  const operatingGoal = optionalText(record.operatingGoal, 500)
    || account.conversionGoal.trim()
    || "持续建立信任并获得有效咨询";
  const requestedAudience = stringList(record.targetAudience, 20);
  const targetAudience = requestedAudience.length ? requestedAudience : account.targetAudience;
  if (!targetAudience.length) throw new PlanValidationError("请先确认目标客户，再生成内容计划。");
  const publishingFrequency = record.publishingFrequency === undefined ? 3 : integer(record.publishingFrequency, 1, 14);
  if (!publishingFrequency) throw new PlanValidationError("每周发布频率必须是 1～14 的整数。");

  return {
    operatingGoal,
    primaryChannel: isContentChannel(record.primaryChannel)
      ? record.primaryChannel
      : inferPrimaryChannel(account.platforms),
    targetAudience,
    publishingFrequency,
    periodStart,
    periodEnd,
    timeZone,
    contextEvidence: parseEvidenceList(record.contextEvidence, 50),
  };
}

export function parsePlanPatch(value: unknown, current: ContentPlan) {
  const record = asRecord(value);
  const update: Partial<Pick<
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
  >> = {};

  if ("title" in record) update.title = requiredText(record.title, "计划名称", 200);
  if ("operatingGoal" in record) update.operatingGoal = requiredText(record.operatingGoal, "经营目标", 500);
  if ("primaryChannel" in record) {
    if (!isContentChannel(record.primaryChannel)) throw new PlanValidationError("主渠道无效。");
    update.primaryChannel = record.primaryChannel;
  }
  if ("targetAudience" in record) {
    const targetAudience = stringList(record.targetAudience, 20);
    if (!targetAudience.length) throw new PlanValidationError("目标客户不能为空。");
    update.targetAudience = targetAudience;
  }
  if ("publishingFrequency" in record) {
    const publishingFrequency = integer(record.publishingFrequency, 1, 14);
    if (!publishingFrequency) throw new PlanValidationError("每周发布频率必须是 1～14 的整数。");
    update.publishingFrequency = publishingFrequency;
  }
  if ("periodStart" in record) update.periodStart = requiredDate(record.periodStart, "开始日期");
  if ("periodEnd" in record) update.periodEnd = requiredDate(record.periodEnd, "结束日期");
  if ("timeZone" in record) update.timeZone = requiredTimeZone(record.timeZone);
  const nextStart = update.periodStart ?? current.periodStart;
  const nextEnd = update.periodEnd ?? current.periodEnd;
  if (nextEnd < nextStart) throw new PlanValidationError("计划结束日期不能早于开始日期。");

  if ("status" in record) {
    if (!contentPlanStatuses.includes(record.status as ContentPlan["status"])) {
      throw new PlanValidationError("计划状态无效。");
    }
    update.status = record.status as ContentPlan["status"];
  }

  if ("pillars" in record) {
    const pillars = parsePillars(record.pillars);
    const pillarIds = new Set(pillars.map((pillar) => pillar.id));
    if (current.items.some((item) => !pillarIds.has(item.pillarId))) {
      throw new PlanValidationError("不能删除仍被选题使用的内容支柱，请先调整相关选题。");
    }
    update.pillars = pillars;
  }

  if (!Object.keys(update).length) throw new PlanValidationError("没有可更新的计划字段。");
  return update;
}

export function parsePlanItemPatch(value: unknown, plan: ContentPlan, current?: ContentPlanItem) {
  const record = asRecord(value);
  const update: Partial<Pick<
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
  >> = {};

  if ("title" in record) update.title = requiredText(record.title, "选题标题", 300);
  if ("angle" in record) update.angle = optionalText(record.angle, 500);
  if ("pillarId" in record) {
    const pillarId = requiredText(record.pillarId, "内容支柱", 200);
    if (!plan.pillars.some((pillar) => pillar.id === pillarId)) {
      throw new PlanValidationError("内容支柱不存在。");
    }
    update.pillarId = pillarId;
  }
  if ("objective" in record) {
    if (!contentObjectives.includes(record.objective as ContentPlanItem["objective"])) {
      throw new PlanValidationError("内容目的无效。");
    }
    update.objective = record.objective as ContentPlanItem["objective"];
  }
  if ("rationale" in record) update.rationale = requiredText(record.rationale, "推荐理由", 1000);
  if ("evidence" in record) {
    const evidence = parseEvidenceList(record.evidence, 20);
    if (!evidence.length) throw new PlanValidationError("选题至少需要一条推荐依据。");
    update.evidence = evidence;
  }
  if ("week" in record) {
    const week = integer(record.week, 1, 5);
    if (!week) throw new PlanValidationError("周次必须是 1～5 的整数。");
    update.week = week;
  }
  if ("scheduledDate" in record) {
    update.scheduledDate = optionalDate(record.scheduledDate);
    if (update.scheduledDate && current?.scheduledDate !== update.scheduledDate) {
      if (update.scheduledDate < plan.periodStart || update.scheduledDate > plan.periodEnd) throw new PlanValidationError("任务日期需要在计划周期内。");
      update.week = Math.floor(daysBetween(plan.periodStart, update.scheduledDate) / 7) + 1;
    }
  }
  if ("priority" in record) {
    const priority = integer(record.priority, 1, 999);
    if (!priority) throw new PlanValidationError("优先级必须是正整数。");
    update.priority = priority;
  }
  if ("locked" in record) {
    if (typeof record.locked !== "boolean") throw new PlanValidationError("锁定状态必须是布尔值。");
    update.locked = record.locked;
  }
  if ("status" in record) {
    if (!contentPlanItemStatuses.includes(record.status as ContentPlanItem["status"])) {
      throw new PlanValidationError("选题状态无效。");
    }
    update.status = record.status as ContentPlanItem["status"];
    if (current && (current.taskType ?? "content") !== "content" && !["pending", "paused", "completed"].includes(update.status)) throw new PlanValidationError("运营任务只能标记待办、暂停或已完成。");
    if (current && (current.taskType ?? "content") === "content" && update.status === "completed") {
      throw new PlanValidationError("内容任务请分别记录创作、审核和实际发布状态。");
    }
  }

  if (!Object.keys(update).length) throw new PlanValidationError("没有可更新的选题字段。");
  return update;
}

export function parseManualTask(value: unknown, plan: ContentPlan) {
  const record = asRecord(value);
  if (!planTaskTypes.includes(record.taskType as (typeof planTaskTypes)[number]) || record.taskType === "content") throw new PlanValidationError("请选择调研、拍照片或补资料任务。");
  const scheduledDate = requiredDate(record.scheduledDate, "任务日期");
  if (scheduledDate < plan.periodStart || scheduledDate > plan.periodEnd) throw new PlanValidationError("任务日期需要在计划周期内。");
  return {
    taskType: record.taskType as Exclude<ContentPlanItem["taskType"], undefined>,
    title: requiredText(record.title, "任务名称", 300),
    rationale: optionalText(record.rationale, 1000) || "由你安排，完成后手动确认。",
    scheduledDate,
  };
}

export function parseEvidenceList(value: unknown, max: number): ContentPlanEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((item, index) => {
    const record = asRecord(item);
    if (!contentPlanEvidenceTypes.includes(record.type as ContentPlanEvidence["type"])) {
      throw new PlanValidationError(`第 ${index + 1} 条依据类型无效。`);
    }
    return {
      type: record.type as ContentPlanEvidence["type"],
      refId: optionalText(record.refId, 500),
      label: requiredText(record.label, `第 ${index + 1} 条依据`, 1000),
    };
  });
}

function parsePillars(value: unknown): ContentPillar[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) {
    throw new PlanValidationError("内容支柱必须是 3～5 个。");
  }
  const pillars = value.map((item, index) => {
    const record = asRecord(item);
    return {
      id: requiredText(record.id, `第 ${index + 1} 个支柱 ID`, 200),
      name: requiredText(record.name, `第 ${index + 1} 个支柱名称`, 100),
      description: requiredText(record.description, `第 ${index + 1} 个支柱说明`, 500),
      priority: integer(record.priority, 1, 99) ?? index + 1,
    };
  });
  if (new Set(pillars.map((pillar) => pillar.id)).size !== pillars.length) {
    throw new PlanValidationError("内容支柱 ID 不能重复。");
  }
  return pillars;
}

function inferPrimaryChannel(platforms: string[]): ContentChannel {
  for (const platform of platforms) {
    const value = platform.toLowerCase();
    if (value.includes("小红书")) return "xiaohongshu_note";
    if (value.includes("朋友圈")) return "moments_post";
    if (value.includes("短视频") || value.includes("视频号") || value.includes("抖音")) return "short_video_script";
    if (value.includes("公众号") || value.includes("微信文章")) return "wechat_article";
  }
  return "wechat_article";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new PlanValidationError(`${label}不能为空。`);
  if (text.length > max) throw new PlanValidationError(`${label}不能超过 ${max} 个字符。`);
  return text;
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, "文本", max);
}

function stringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((item) => String(item).trim()).filter(Boolean);
}

function integer(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

function requiredDate(value: unknown, label: string) {
  const date = parseDate(value);
  if (!date) throw new PlanValidationError(`${label}必须使用 YYYY-MM-DD 格式。`);
  return date;
}

function optionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredDate(value, "计划日期");
}

function requiredTimeZone(value: unknown) {
  if (typeof value !== "string" || value.length > 100) throw new PlanValidationError("时区无效。");
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); }
  catch { throw new PlanValidationError("时区无效，请使用 Asia/Shanghai 等时区名称。"); }
  return value;
}
