import { randomUUID } from "node:crypto";
import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import type {
  EnterpriseKnowledgeProfile,
  EnterpriseKnowledgeProfileInput,
  KnowledgeProfileFact,
  KnowledgeProfileOffer,
  KnowledgeProfileSource,
} from "./types";

const MAX_SOURCES = 30;
const MAX_SOURCE_CHARS = 8_000;
const MAX_BATCH_CHARS = 32_000;
const sourceTypes = new Set<BriefKnowledgeSource["source"]>(["local", "feishu", "base", "upload"]);

export function normalizeKnowledgeProfileSources(value: unknown): BriefKnowledgeSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): BriefKnowledgeSource[] => {
    const item = asRecord(entry);
    const id = text(item.id, 500);
    const title = text(item.title, 300);
    const source = String(item.source ?? "") as BriefKnowledgeSource["source"];
    const sourceText = text(item.text, 12_000);
    if (!id || !title || !sourceText || !sourceTypes.has(source)) return [];
    return [{
      id,
      title,
      source,
      text: sourceText,
      url: text(item.url, 2_000) || undefined,
      path: text(item.path, 2_000) || undefined,
    }];
  }).slice(0, MAX_SOURCES);
}

export async function analyzeEnterpriseKnowledge(
  sources: BriefKnowledgeSource[],
): Promise<EnterpriseKnowledgeProfileInput> {
  const usable = sources
    .filter((source) => source.id.trim() && source.title.trim() && source.text.trim())
    .slice(0, MAX_SOURCES);
  if (!usable.length) throw new Error("请至少选择一份有正文的知识资料。");

  const batches = splitBatches(usable);
  const partials = [];
  for (const batch of batches) partials.push(await compileBatch(batch));
  if (partials.length === 1) return normalizeKnowledgeProfileInput(partials[0], usable);

  const merged = await requestProfile([
    "下面是多批资料分别提炼出的结构化结果。请合并同义项、保留来源编号，输出一份完整企业知识档案。",
    "不得新增批次结果中不存在的企业事实。无法确认的推断必须放入 gaps，或把 fact.confidence 标成 needs_confirmation。",
    JSON.stringify(partials),
  ].join("\n"));
  return normalizeKnowledgeProfileInput(merged, usable);
}

async function compileBatch(sources: BriefKnowledgeSource[]) {
  const context = sources.map((source) => [
    `[${source.id}] ${source.title}`,
    source.text.slice(0, MAX_SOURCE_CHARS),
  ].join("\n")).join("\n\n");
  return requestProfile([
    "请根据以下资料提炼企业知识档案。",
    "每条事实和产品都只能引用方括号中的来源编号；不确定的信息必须标记待确认，不能补造。",
    context,
  ].join("\n"));
}

async function requestProfile(userContent: string) {
  const content = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是企业知识档案编译器。只输出 JSON，不要 Markdown。",
        "字段必须包含 name, businessSummary, targetCustomers, offers, strengths, businessGoals, preferredTopics, forbiddenClaims, facts, gaps。",
        "offers 每项包含 name, description, differentiators, sourceIds。",
        "facts 每项包含 category, statement, confidence, sourceIds；confidence 只能是 confirmed 或 needs_confirmation。",
        "资料明确支持且带有效 sourceIds 才能用 confirmed；任何推断或缺少来源的内容必须用 needs_confirmation。",
      ].join("\n"),
    },
    { role: "user", content: userContent },
  ], { minimumTimeoutMs: 180_000 });
  return parseJsonObject(content);
}

export function normalizeKnowledgeProfileInput(
  value: unknown,
  sources: Array<Pick<BriefKnowledgeSource, "id" | "title" | "source" | "url" | "path">>,
): EnterpriseKnowledgeProfileInput {
  const record = asRecord(value);
  const sourceRefs: KnowledgeProfileSource[] = sources.map((source) => ({
    id: text(source.id, 500),
    title: text(source.title, 300),
    sourceType: source.source,
    url: text(source.url, 2_000) || undefined,
    path: text(source.path, 2_000) || undefined,
  }));
  const allowedSources = new Set(sourceRefs.map((source) => source.id));
  return {
    name: text(record.name, 200) || "当前企业知识档案",
    businessSummary: text(record.businessSummary, 3_000),
    targetCustomers: stringList(record.targetCustomers, 30, 500),
    offers: Array.isArray(record.offers)
      ? record.offers.slice(0, 30).flatMap((value): KnowledgeProfileOffer[] => {
          const item = asRecord(value);
          const name = text(item.name, 300);
          if (!name) return [];
          return [{
            id: text(item.id, 500) || `offer_${randomUUID()}`,
            name,
            description: text(item.description, 2_000),
            differentiators: stringList(item.differentiators, 20, 500),
            sourceIds: validSourceIds(item.sourceIds, allowedSources),
          }];
        })
      : [],
    strengths: stringList(record.strengths, 30, 500),
    businessGoals: stringList(record.businessGoals, 30, 500),
    preferredTopics: stringList(record.preferredTopics, 50, 500),
    forbiddenClaims: stringList(record.forbiddenClaims, 50, 500),
    facts: Array.isArray(record.facts)
      ? record.facts.slice(0, 100).flatMap((value): KnowledgeProfileFact[] => {
          const item = asRecord(value);
          const statement = text(item.statement, 2_000);
          if (!statement) return [];
          const sourceIds = validSourceIds(item.sourceIds, allowedSources);
          return [{
            id: text(item.id, 500) || `fact_${randomUUID()}`,
            category: text(item.category, 100) || "其他",
            statement,
            confidence: item.confidence === "confirmed" && sourceIds.length
              ? "confirmed"
              : "needs_confirmation",
            sourceIds,
          }];
        })
      : [],
    gaps: stringList(record.gaps, 50, 1_000),
    sources: sourceRefs,
  };
}

export function formatKnowledgeProfileForPrompt(
  profile: EnterpriseKnowledgeProfile | null,
) {
  if (!profile) return "尚未确认企业知识档案，不得补造企业事实。";
  return JSON.stringify({
    name: profile.name,
    version: profile.version,
    businessSummary: profile.businessSummary,
    targetCustomers: profile.targetCustomers,
    offers: profile.offers,
    strengths: profile.strengths,
    businessGoals: profile.businessGoals,
    preferredTopics: profile.preferredTopics,
    forbiddenClaims: profile.forbiddenClaims,
    confirmedFacts: profile.facts.filter((fact) => fact.confidence === "confirmed"),
    gaps: profile.gaps,
  }, null, 2);
}

function splitBatches(sources: BriefKnowledgeSource[]) {
  const batches: BriefKnowledgeSource[][] = [];
  let current: BriefKnowledgeSource[] = [];
  let currentLength = 0;
  for (const source of sources) {
    const length = Math.min(source.text.length, MAX_SOURCE_CHARS);
    if (current.length && currentLength + length > MAX_BATCH_CHARS) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(source);
    currentLength += length;
  }
  if (current.length) batches.push(current);
  return batches;
}

function validSourceIds(value: unknown, allowed: Set<string>) {
  return stringList(value, 30, 500).filter((sourceId) => allowed.has(sourceId));
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}
