import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import { formatStyleContractForPrompt } from "@/modules/style-profile/prompt";
import type { StyleContract } from "@/modules/style-profile/types";
import { getChannelSystemPrompt } from "./channel-prompts";
import type { BriefKnowledgeSource, ChannelDraft, ContentBrief, ContentChannel } from "./types";

type GenerateChannelInput = {
  channel: ContentChannel;
  brief: ContentBrief;
  sources: BriefKnowledgeSource[];
  accountContext: AccountContext | null;
  styleContract: StyleContract | null;
};

export async function generateChannelDraft(input: GenerateChannelInput): Promise<ChannelDraft> {
  const rawContent = await chatCompletionJson([
    { role: "system", content: getChannelSystemPrompt(input.channel) },
    { role: "user", content: buildChannelContext(input) },
  ]);
  const parsed = parseJsonObject(rawContent) as { content?: unknown };
  const content = String(parsed.content ?? "").trim();
  if (!content) throw new Error("渠道稿件为空，请重试。");

  return { channel: input.channel, content, status: "generated", updatedAt: new Date().toISOString() };
}

function buildChannelContext(input: GenerateChannelInput) {
  const knowledge = input.sources
    .map((source, index) => `[${index + 1}] ${source.title}\n来源: ${source.source}\n${(source.text ?? "").slice(0, 6000)}`)
    .join("\n\n");

  return [
    "【统一内容简报】",
    JSON.stringify(input.brief, null, 2),
    "【当前账号上下文】",
    input.accountContext ? JSON.stringify(input.accountContext, null, 2) : "未确认，不要虚构品牌事实。",
    "【已确认写作风格】",
    formatStyleContractForPrompt(input.styleContract, input.channel),
    "【知识证据】",
    knowledge || "暂无证据，涉及事实的内容必须标记待确认。",
  ].join("\n\n");
}
