import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import { formatStyleContractForPrompt } from "@/modules/style-profile/prompt";
import type { StyleContract } from "@/modules/style-profile/types";
import { getChannelSystemPrompt } from "./channel-prompts";
import { checkContentFacts, ContentFactError } from "./fact-check";
import type { BriefKnowledgeSource, ChannelDraft, ContentBrief, ContentChannel } from "./types";

type GenerateChannelInput = {
  channel: ContentChannel;
  brief: ContentBrief;
  sources: BriefKnowledgeSource[];
  accountContext: AccountContext | null;
  styleContract: StyleContract | null;
};

export async function generateChannelDraft(input: GenerateChannelInput): Promise<ChannelDraft> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: getChannelSystemPrompt(input.channel) },
    { role: "user", content: buildChannelContext(input) },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = parseJsonObject(await chatCompletionJson(messages, { timeoutMs: 45_000 })) as { content?: unknown };
    const content = String(parsed.content ?? "").trim();
    if (!content) throw new Error("渠道稿件为空，请重试。");
    const issues = await checkContentFacts(content, input.sources, input.accountContext);
    if (!issues.length) return { channel: input.channel, content, status: "generated", updatedAt: new Date().toISOString() };
    if (attempt === 1) throw new ContentFactError(`资料不足，未交付这篇成稿。请补充或删去这些内容：${issues.map((issue) => `${issue.originalText}（${issue.reason}）`).join("；")}。也可以先选择主营业务介绍。`);
    messages.push({ role: "user", content: `上一稿事实核对未通过：${JSON.stringify(issues)}。请重新输出完整稿件，删除或改成有依据的表达，不能补造替代事实。只使用原始资料；可以收缩主题和篇幅，未知内容留待用户补充。上一稿：\n${content}` });
  }
  throw new ContentFactError("事实核对未通过，请补充资料。");
}

function buildChannelContext(input: GenerateChannelInput) {
  const knowledge = input.sources
    .map((source, index) => `[${index + 1}] ${source.title}\n来源: ${source.source}\n${(source.text ?? "").slice(0, 6000)}`)
    .join("\n\n");

  return [
    "【统一内容简报：用于组织表达，AI 中间产物，不作为独立事实证据】",
    JSON.stringify(input.brief, null, 2),
    "【当前账号上下文】",
    input.accountContext ? JSON.stringify(input.accountContext, null, 2) : "未确认，不要虚构品牌事实。",
    "【已确认写作风格】",
    formatStyleContractForPrompt(input.styleContract, input.channel),
    "【知识证据】",
    knowledge || "暂无证据，涉及事实的内容必须标记待确认。",
  ].join("\n\n");
}
