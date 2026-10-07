import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import type { BriefKnowledgeSource } from "./types";
import { writingEvidenceRules } from "./writing-rules";

export class ContentFactError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}

export async function checkContentFacts(content: string, sources: BriefKnowledgeSource[], account: AccountContext | null) {
  let record: Record<string, unknown>;
  try {
    const raw = await chatCompletionJson([
      { role: "system", content: [
        "你是成稿事实核验员。独立核对待审正文与原始资料，只输出 JSON。",
        writingEvidenceRules,
        "逐项检查产品数量/风味/价格、效果、顾客评价、第一人称经历、引文和人物动机。一般建议与明确的邀请不是已发生事实，不能把它们误判为虚构经历。",
        "资料中没有某项信息，不等于能用常识补上。资料说未知的细节不得当作已确认；品牌语气、目标人群假设和表达样例都不证明实际经营或经历。",
        "请先逐句拆出正文的事实主张，并为每项寻找原始资料中逐字的直接证据。资料‘提供咖啡’不能证明‘几款’‘果香’‘坚果’等细节，不能以整段大致相符替代细节核验。无直接证据的主张必须计入 issues。不得从正文反推资料；没有提供不代表确认存在。",
        "特别检查否定和状态变化：‘未提供价格’不能支持‘价格还没定好’‘还没整理好’，‘未提供门店信息’不能支持‘没有门店’。这些也是事实主张，必须核对；指出无依据的状态描述。",
        '输出 {"verdict":"supported|unsupported","issues":[{"originalText":"逐字摘自正文的问题片段","reason":"缺什么独立依据"}]}。有任何缺乏依据的事实时 verdict=unsupported；全部事实有依据时 supported 且 issues=[]。不要为了凑问题而挑错。',
      ].join("\n") },
      { role: "user", content: JSON.stringify({
        confirmedBusiness: account ? { name: account.accountName, business: account.business, offer: account.offer, goal: account.conversionGoal, answers: account.answeredQuestions ?? [] } : null,
        sources: sources.map((source) => ({ id: source.id, title: source.title, text: source.text.slice(0, 6000) })),
        content,
      }) },
    ], { timeoutMs: 30_000 });
    record = parseJsonObject(raw) as Record<string, unknown>;
    if (!record || !["supported", "unsupported"].includes(String(record.verdict)) || !Array.isArray(record.issues)) throw new Error("Invalid fact check");
    if (record.verdict === "supported" && record.issues.length) throw new Error("Inconsistent fact check");
  } catch {
    throw new ContentFactError("事实核对暂时未完成，请稍后重试；系统没有交付未经核对的成稿。", 503);
  }
  if (record.verdict === "supported") return [];
  const issues = (record.issues as Array<Record<string, unknown>>).flatMap((issue) => {
    const originalText = typeof issue?.originalText === "string" ? issue.originalText.trim() : "";
    const reason = typeof issue?.reason === "string" ? issue.reason.trim().slice(0, 500) : "";
    return originalText && content.includes(originalText) && reason ? [{ originalText, reason }] : [];
  }).slice(0, 12);
  if (!issues.length) throw new ContentFactError("资料还不足以核对这篇内容，请补充产品细节或选择主营业务介绍等已有依据的选题。");
  return issues;
}
