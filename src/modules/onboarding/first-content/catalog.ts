import type { AccountContext } from "@/modules/positioning/types";
import type { StyleProfileInput } from "@/modules/style-profile/types";

// 兼容旧档案和已打开页面的请求，不再作为界面的行业选项。
const legacyIndustryIds = ["coffee", "flooring", "general"] as const;
export type IndustryId = typeof legacyIndustryIds[number];
export const starterGuidance = {
  directions: ["业务介绍", "产品与服务", "客户咨询的问题"],
  needed: "产品或服务介绍、真实特点、适用条件和可公开的资料",
  rule: "先介绍已确认的业务与产品，明确适用条件；没有资料的卖点、价格、效果和经历留待补充。",
};
export const voices = [
  { id: "chat", name: "温柔朋友式", tone: "温和、亲切、口语", rule: "像向熟悉的朋友解释，短句清楚，回应读者的疑问，不催促、不强行煽情。" },
  { id: "lifestyle", name: "轻松愉快", tone: "轻松、自然、有活力", rule: "用自然短句和轻快的段落推进，少堆形容词，不为营造气氛编造现场或经历。" },
  { id: "professional", name: "专业介绍", tone: "清晰、具体、可信", rule: "先交代业务和本次介绍对象，再给出咨询入口；解释条件，避免绝对承诺。" },
] as const;
export type VoiceId = typeof voices[number]["id"];
export const starterVersion = 3;

export function isIndustry(value: unknown): value is IndustryId { return legacyIndustryIds.some((id) => id === value); }
export function isVoice(value: unknown): value is VoiceId { return voices.some((item) => item.id === value); }

export function buildStarterStyle(account: AccountContext, industryId: IndustryId, voiceId: VoiceId, adjustments = ""): StyleProfileInput {
  const voice = voices.find((item) => item.id === voiceId)!;
  const sourceId = `starter:${industryId}:v${starterVersion}:${voice.id}`;
  const examples: Record<VoiceId, string> = {
    chat: `先认识一下${account.accountName}。${account.business}。这次想和大家介绍${account.offer}，想了解什么，可以留言问我们。`,
    lifestyle: `来认识一下${account.accountName}吧。\n\n我们${account.business}，这次聊聊${account.offer}。\n\n你想先了解哪一点？欢迎留言。`,
    professional: `业务介绍：${account.accountName}\n主营业务：${account.business}\n本次介绍：${account.offer}\n如需了解具体信息，欢迎提出问题，我们再逐项说明。`,
  };
  const excerpt = examples[voiceId];
  const rules = [voice.rule, starterGuidance.rule, ...(adjustments.trim() ? [adjustments.trim()] : [])].map((instruction, index) => ({
    id: index === 2 ? "starter-rule-extra" : `starter-rule-${index}`, category: "language" as const, priority: "soft" as const, instruction,
    evidence: [{ sourceId, excerpt: instruction, note: "用户选中的初始表达方式，可继续修改。" }],
  }));
  return {
    name: `${account.accountName} · ${voice.name}`, persona: "以当前品牌介绍者的视角表达，口吻不能提供身份或经历事实。",
    readerRelationship: "向希望了解当前业务的读者介绍真实信息", values: ["真实", "清楚"], tone: [voice.tone],
    rules, preferredPhrases: account.preferredPhrases, bannedPhrases: account.bannedPhrases,
    channelOverrides: {}, examples: [{ id: "starter-example", sourceId: `${sourceId}:sample`, title: "用户选择的口吻示例", excerpt, purpose: "学习表达方式，不作为其他稿件的事实证据。" }],
    sources: [
      { id: sourceId, title: `初始写作配置 v${starterVersion}与用户补充要求`, sourceType: "manual", role: "style_guide" },
      { id: `${sourceId}:sample`, title: "同一组已确认信息的口吻示例", sourceType: "manual", role: "approved_sample" },
    ],
    starterTemplate: { industry: industryId, voice: voiceId, version: starterVersion },
  };
}

export function mergeStarterStyle(next: StyleProfileInput, current: StyleProfileInput | null): StyleProfileInput {
  if (!current) return next;
  // 只替换未经用户改动的模板基础规则；用户改写、硬规则与补充偏好均保留。
  const personalRules = current.rules.filter((rule) => {
    if (rule.id === "starter-rule-extra") return !next.rules.some((item) => item.id === rule.id);
    const baseRule = rule.id === "starter-rule-0" || rule.id === "starter-rule-1";
    return !baseRule || rule.priority === "hard" || !rule.evidence.some((item) => item.excerpt === rule.instruction);
  });
  const personalIds = new Set(personalRules.map((rule) => rule.id));
  return {
    ...current, ...next,
    persona: current.persona, readerRelationship: current.readerRelationship, values: current.values,
    rules: [...personalRules, ...next.rules.filter((rule) => !personalIds.has(rule.id)).map((rule) => {
      const previous = current.rules.find((item) => item.id === rule.id);
      return rule.id === "starter-rule-extra" && previous ? { ...rule, priority: previous.priority } : rule;
    })],
    examples: [...next.examples, ...current.examples.filter((example) => example.id !== "starter-example")],
    sources: [...new Map([...current.sources, ...next.sources].map((source) => [source.id, source])).values()],
    preferredPhrases: [...new Set([...current.preferredPhrases, ...next.preferredPhrases])],
    bannedPhrases: [...new Set([...current.bannedPhrases, ...next.bannedPhrases])],
    channelOverrides: current.channelOverrides,
  };
}

export function styleDifferences(current: StyleProfileInput | null, next: StyleProfileInput) {
  const fields = [
    { label: "语气", before: current?.tone ?? [], after: next.tone },
    { label: "表达规则", before: current?.rules.map((rule) => rule.instruction) ?? [], after: next.rules.map((rule) => rule.instruction) },
    { label: "示例", before: current?.examples.map((example) => example.excerpt) ?? [], after: next.examples.map((example) => example.excerpt) },
  ];
  return fields.filter((field) => JSON.stringify(field.before) !== JSON.stringify(field.after));
}

export function starterTopics(account: AccountContext) {
  const offer = account.offer.slice(0, 90);
  return [
    { id: "intro", title: `先认识${account.accountName}：我们主要提供什么`, reason: "用已确认的主营业务和品牌名称介绍自己。", needs: "有已确认的业务信息即可开始" },
    { id: "offer", title: `这次先介绍${offer}`, reason: "围绕当前主推产品或服务，只讲资料已支持的内容。", needs: "更具体的特点、价格和适用条件可后补；未知细节不写" },
    { id: "questions", title: `了解${offer}，可以先问哪些问题`, reason: "给读者一个咨询入口，不编造已经发生的顾客提问。", needs: "只列建议询问的问题，回答需有真实资料" },
  ];
}
