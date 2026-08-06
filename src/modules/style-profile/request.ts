import { contentChannels, isContentChannel, type ContentChannel } from "@/modules/content/types";
import {
  styleRuleCategories,
  styleSourceRoles,
  styleSourceTypes,
  type StyleEvidence,
  type StyleExample,
  type StyleProfileInput,
  type StyleRule,
  type StyleSourceReference,
} from "./types";

const sourceTypeSet = new Set(styleSourceTypes);
const sourceRoleSet = new Set(styleSourceRoles);
const ruleCategorySet = new Set(styleRuleCategories);

export function normalizeStyleProfileInput(value: unknown): StyleProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = limitedString(record.name, 120);
  const persona = limitedString(record.persona, 1_000);
  const readerRelationship = limitedString(record.readerRelationship, 600);
  if (!name || !persona || !readerRelationship) return null;

  return {
    name,
    persona,
    readerRelationship,
    values: stringList(record.values, 20, 300),
    tone: stringList(record.tone, 20, 200),
    rules: normalizeRules(record.rules),
    preferredPhrases: stringList(record.preferredPhrases, 50, 300),
    bannedPhrases: stringList(record.bannedPhrases, 100, 300),
    channelOverrides: normalizeChannelOverrides(record.channelOverrides),
    examples: normalizeExamples(record.examples),
    sources: normalizeSources(record.sources),
  };
}

export function validateStyleProfileForConfirmation(profile: StyleProfileInput) {
  const issues: string[] = [];
  const sourceIds = new Set(profile.sources.map((source) => source.id));
  if (!profile.sources.length) issues.push("至少需要一份风格资料来源。");
  if (!profile.rules.length) issues.push("至少需要一条可执行的风格规则。");
  if (!profile.examples.length) issues.push("至少需要一个经过确认的原文样例。");

  profile.rules.forEach((rule, index) => {
    if (!rule.evidence.length) issues.push(`第 ${index + 1} 条风格规则缺少原文依据。`);
    rule.evidence.forEach((evidence) => {
      if (!sourceIds.has(evidence.sourceId)) {
        issues.push(`风格规则引用了不存在的资料：${evidence.sourceId}。`);
      }
    });
  });
  profile.examples.forEach((example) => {
    if (!sourceIds.has(example.sourceId)) {
      issues.push(`风格样例引用了不存在的资料：${example.sourceId}。`);
    }
  });

  return Array.from(new Set(issues));
}

function normalizeSources(value: unknown): StyleSourceReference[] {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = limitedString(record.title, 300);
    const sourceType = String(record.sourceType ?? "") as StyleSourceReference["sourceType"];
    const role = String(record.role ?? "") as StyleSourceReference["role"];
    if (!title || !sourceTypeSet.has(sourceType) || !sourceRoleSet.has(role)) return [];
    return [{
      id: normalizeId(record.id, `styleSources_${index + 1}`),
      title,
      sourceType,
      role,
      url: optionalHttpUrl(record.url),
      path: optionalString(record.path, 2_000),
    }];
  })).slice(0, 30);
}

function normalizeRules(value: unknown): StyleRule[] {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const category = String(record.category ?? "") as StyleRule["category"];
    const priority: StyleRule["priority"] = record.priority === "hard" ? "hard" : "soft";
    const instruction = limitedString(record.instruction, 1_000);
    if (!ruleCategorySet.has(category) || !instruction) return [];
    return [{
      id: normalizeId(record.id, `styleRules_${index + 1}`),
      category,
      priority,
      instruction,
      evidence: normalizeEvidence(record.evidence),
    }];
  })).slice(0, 40);
}

function normalizeEvidence(value: unknown): StyleEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const sourceId = limitedString(record.sourceId, 160);
    const excerpt = limitedString(record.excerpt, 1_500);
    if (!sourceId || !excerpt) return [];
    return [{ sourceId, excerpt, note: optionalString(record.note, 500) }];
  }).slice(0, 8);
}

function normalizeExamples(value: unknown): StyleExample[] {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const sourceId = limitedString(record.sourceId, 160);
    const title = limitedString(record.title, 300);
    const excerpt = limitedString(record.excerpt, 3_000);
    const purpose = limitedString(record.purpose, 500);
    if (!sourceId || !title || !excerpt || !purpose) return [];
    return [{
      id: normalizeId(record.id, `styleExamples_${index + 1}`),
      sourceId,
      title,
      excerpt,
      purpose,
      channel: isContentChannel(record.channel) ? record.channel : undefined,
    }];
  })).slice(0, 12);
}

function normalizeChannelOverrides(value: unknown): Partial<Record<ContentChannel, string[]>> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(contentChannels.flatMap((channel) => {
    const rules = stringList(record[channel], 20, 500);
    return rules.length ? [[channel, rules]] : [];
  })) as Partial<Record<ContentChannel, string[]>>;
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => limitedString(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeId(value: unknown, fallback: string) {
  const id = String(value ?? "").trim();
  return id && id.length <= 160 && !/[\u0000-\u001f\u007f]/.test(id) ? id : fallback;
}

function optionalString(value: unknown, limit: number) {
  const normalized = limitedString(value, limit);
  return normalized || undefined;
}

function optionalHttpUrl(value: unknown) {
  const normalized = optionalString(value, 2_000);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function limitedString(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}
