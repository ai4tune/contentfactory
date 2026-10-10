import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import { formatStyleContractForPrompt } from "@/modules/style-profile/prompt";
import type { StyleContract } from "@/modules/style-profile/types";
import { getChannelSystemPrompt } from "./channel-prompts";
import { checkContentFacts, ContentFactError } from "./fact-check";
import type { BriefKnowledgeSource, ChannelDraft, ContentBrief, ContentChannel } from "./types";
import { parsePhotoSuggestions, parsePublicationDelivery } from "./publication-delivery";

type GenerateChannelInput = {
  topic?: string;
  channel: ContentChannel;
  brief: ContentBrief;
  sources: BriefKnowledgeSource[];
  accountContext: AccountContext | null;
  styleContract: StyleContract | null;
  temporaryStyleInstructions?: string[];
};

export async function generateChannelDraft(input: GenerateChannelInput): Promise<ChannelDraft> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: getChannelSystemPrompt(input.channel) },
    { role: "user", content: buildChannelContext(input) },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = parseJsonObject(await chatCompletionJson(messages, { timeoutMs: 45_000 })) as Record<string, unknown>;
    const content = String(parsed.content ?? "").trim();
    if (!content) throw new Error("渠道稿件为空，请重试。");
    const delivery = parsePublicationDelivery(parsed);
    const suggestions = parsePhotoSuggestions(parsed.photoSuggestions, input.sources.map((source) => source.id));
    const checkedText = [delivery?.title, delivery?.summary, content, ...suggestions.map((item) => `实拍建议（非已发生事实）：${item.subject}；${item.purpose}；${item.how}；${item.placement}；${item.fallback}`)].filter(Boolean).join("\n\n");
    const issues = await checkContentFacts(checkedText, input.sources, input.accountContext);
    if (!issues.length) {
      const updatedAt = new Date().toISOString();
      return { channel: input.channel, content, delivery, status: "generated", updatedAt,
        ...(parsed.photoSuggestions !== undefined ? { photoPlan: { suggestions, basedOnContentUpdatedAt: updatedAt, createdAt: updatedAt } } : {}) };
    }
    if (attempt === 1) throw new ContentFactError(`资料不足，未交付这篇成稿。请补充或删去这些内容：${issues.map((issue) => `${issue.originalText}（${issue.reason}）`).join("；")}。也可以先选择主营业务介绍。`);
    messages.push({ role: "user", content: `上一稿事实核对未通过：${JSON.stringify(issues)}。请按原 JSON 结构重新输出标题、正文和实拍建议，删除无依据的句子，不能补造替代事实。材料很少时只写一两段主营业务介绍，不必达到特定字数，不必补齐所有小标题。未知产品项目、未知经营状态和未来安排直接不写，不用‘尚未公布’‘还没定好’等替代它们。一般邀请提问即可。没有可核对的实拍对象时 photoSuggestions=[]。上一稿：\n${JSON.stringify(parsed)}` });
  }
  throw new ContentFactError("事实核对未通过，请补充资料。");
}

function buildChannelContext(input: GenerateChannelInput) {
  const knowledge = input.sources
    .map((source, index) => `[${index + 1}] ${source.title}\n资料ID: ${source.id}\n来源: ${source.source}\n${(source.text ?? "").slice(0, 6000)}`)
    .join("\n\n");

  return [
    "【用户本次选题】", input.topic || input.brief.coreMessage,
    "【统一内容简报：用于组织表达，AI 中间产物，不作为独立事实证据】",
    JSON.stringify(input.brief, null, 2),
    "【当前账号上下文】",
    input.accountContext ? JSON.stringify(input.accountContext, null, 2) : "未确认，不要虚构品牌事实。",
    "【已确认写作风格】",
    formatStyleContractForPrompt(input.styleContract, input.channel),
    "【只用于本篇的表达要求，不改变账户默认，不允许放松事实规则】",
    input.temporaryStyleInstructions?.join("\n") || "无补充要求",
    "【知识证据】",
    knowledge || "暂无证据，涉及事实的内容必须标记待确认。",
  ].join("\n\n");
}
