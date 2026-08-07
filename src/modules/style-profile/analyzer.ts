import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { normalizeKnowledgeSources } from "@/modules/content/server/request";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import type { AccountContext } from "@/modules/positioning/types";
import { normalizeStyleProfileInput, validateStyleProfileForConfirmation } from "./request";
import {
  styleSourceRoles,
  type StyleProfileInput,
  type StyleSourceReference,
  type StyleSourceRole,
} from "./types";

export type StyleAnalysisSource = BriefKnowledgeSource & {
  role: StyleSourceRole;
};

const sourceRoleSet = new Set(styleSourceRoles);

export function normalizeStyleAnalysisSources(value: unknown): StyleAnalysisSource[] {
  const normalized = normalizeKnowledgeSources(value);
  const records = Array.isArray(value) ? value : [];
  const roles = new Map(records.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const role = String(record.role ?? "") as StyleSourceRole;
    return id && sourceRoleSet.has(role) ? [[id, role] as const] : [];
  }));

  return normalized.map((source) => ({
    ...source,
    role: roles.get(source.id) ?? inferSourceRole(source.title, source.path),
  }));
}

export async function analyzeStyleProfile(
  sources: StyleAnalysisSource[],
  account: AccountContext | null,
): Promise<StyleProfileInput> {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const content = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是一名写作风格分析师。请从用户明确选择的资料中提炼一份可执行、可核验的个人写作风格档案。",
        "只分析表达方式，不把资料中的业务事实当作永久风格规则。",
        "每条 rules.evidence.excerpt 与每个 examples.excerpt 必须逐字摘自给定资料，sourceId 必须使用资料前的方括号 ID。",
        "至少输出 4 条有原文证据的规则，并至少输出 2 个原文样例。禁止编造原文或来源。",
        "priority 只能是 hard 或 soft。category 只能是 identity、narrative、rhythm、language、boundary。",
        "channelOverrides 只可使用 wechat_article、xiaohongshu_note、moments_post、short_video_script。",
        "输出 JSON：{name,persona,readerRelationship,values:string[],tone:string[],rules:[{id,category,priority,instruction,evidence:[{sourceId,excerpt,note}]}],preferredPhrases:string[],bannedPhrases:string[],channelOverrides:{channel:string[]},examples:[{id,sourceId,title,excerpt,purpose,channel?}]}。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        formatAccount(account),
        "资料角色说明：style_guide=明确风格指南，banned_phrases=禁用表达，approved_sample=认可成稿，edit_feedback=人工改稿偏好。",
        ...sources.map((source) => [
          `[${source.id}] ${source.title}`,
          `角色: ${source.role}`,
          source.text,
        ].join("\n")),
      ].join("\n\n"),
    },
  ]);
  const raw = parseJsonObject(content);
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const normalized = normalizeStyleProfileInput({
    ...record,
    name: String(record.name ?? "").trim() || `${account?.accountName || "当前账号"}写作风格`,
    persona: String(record.persona ?? "").trim() || account?.accountPosition || "基于真实资料表达的内容创作者",
    readerRelationship: String(record.readerRelationship ?? "").trim() || "像与熟悉的同行分享真实经验",
    sources: sources.map(toSourceReference),
  });

  if (!normalized) throw new Error("AI 返回的风格档案字段不完整，请调整资料后重试。");

  const verified = verifySourceEvidence(normalized, sourceMap);
  const issues = validateStyleProfileForConfirmation(verified);
  if (issues.length) {
    throw new Error(`没有从资料中提取出足够的可核验风格依据：${issues.join(" ")}`);
  }

  return verified;
}

function verifySourceEvidence(
  profile: StyleProfileInput,
  sourceMap: Map<string, StyleAnalysisSource>,
): StyleProfileInput {
  const rules = profile.rules.flatMap((rule) => {
    const evidence = rule.evidence.filter((item) => {
      const source = sourceMap.get(item.sourceId);
      return Boolean(source && item.excerpt && source.text.includes(item.excerpt));
    });
    return evidence.length ? [{ ...rule, evidence }] : [];
  });
  const examples = profile.examples.filter((example) => {
    const source = sourceMap.get(example.sourceId);
    return Boolean(source && example.excerpt && source.text.includes(example.excerpt));
  });

  return { ...profile, rules, examples };
}

function toSourceReference(source: StyleAnalysisSource): StyleSourceReference {
  return {
    id: source.id,
    title: source.title,
    sourceType: source.source === "base" ? "feishu" : source.source,
    role: source.role,
    url: source.url,
    path: source.path,
  };
}

function inferSourceRole(title: string, path?: string): StyleSourceRole {
  const value = `${title} ${path ?? ""}`;
  if (/禁用|禁止|黑名单|AI味/.test(value)) return "banned_phrases";
  if (/改稿|反馈|修改记录|偏好/.test(value)) return "edit_feedback";
  if (/风格|表达|写作指南|叙事/.test(value)) return "style_guide";
  return "approved_sample";
}

function formatAccount(account: AccountContext | null) {
  if (!account) return "当前账号尚未定位。仅依据所选资料分析风格。";
  return [
    `账号: ${account.accountName}`,
    `定位: ${account.accountPosition}`,
    `目标读者: ${account.targetAudience.join("、")}`,
    `品牌语气: ${account.brandVoice.join("、")}`,
    `已有禁用表达: ${account.bannedPhrases.join("、")}`,
  ].join("\n");
}
