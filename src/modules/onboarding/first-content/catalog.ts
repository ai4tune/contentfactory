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
  { id: "chat", name: "亲切聊天", tone: "亲切、口语、简洁", rule: "用日常短句介绍已知信息，少用术语，结尾自然邀请提问。" },
  { id: "lifestyle", name: "生活方式", tone: "自然、舒缓、克制", rule: "段落留出停顿，围绕本次产品或服务展开，不为营造氛围编造现场。" },
  { id: "professional", name: "专业介绍", tone: "清晰、具体、可信", rule: "先交代业务和本次介绍对象，再给出咨询入口；解释条件，避免绝对承诺。" },
] as const;
export type VoiceId = typeof voices[number]["id"];
export const starterVersion = 2;

export function isIndustry(value: unknown): value is IndustryId { return legacyIndustryIds.some((id) => id === value); }
export function isVoice(value: unknown): value is VoiceId { return voices.some((item) => item.id === value); }

export function buildStarterStyle(account: AccountContext, industryId: IndustryId, voiceId: VoiceId, adjustments = ""): StyleProfileInput {
  const voice = voices.find((item) => item.id === voiceId)!;
  const sourceId = `starter:${industryId}:v${starterVersion}:${voice.id}`;
  const examples: Record<VoiceId, string> = {
    chat: `先认识一下${account.accountName}。${account.business}。这次想和大家介绍${account.offer}，想了解什么，可以留言问我们。`,
    lifestyle: `${account.accountName}。\n\n${account.business}。这次，先把${account.offer}介绍清楚。\n\n有想了解的问题，欢迎聊聊。`,
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

export function starterTopics(account: AccountContext) {
  const offer = account.offer.slice(0, 90);
  return [
    { id: "intro", title: `先认识${account.accountName}：我们主要提供什么`, reason: "用已确认的主营业务和品牌名称介绍自己。", needs: "有已确认的业务信息即可开始" },
    { id: "offer", title: `这次先介绍${offer}`, reason: "围绕当前主推产品或服务，只讲资料已支持的内容。", needs: "更具体的特点、价格和适用条件可后补；未知细节不写" },
    { id: "questions", title: `了解${offer}，可以先问哪些问题`, reason: "给读者一个咨询入口，不编造已经发生的顾客提问。", needs: "只列建议询问的问题，回答需有真实资料" },
  ];
}
