import type { ContentChannel } from "@/modules/content/types";
import type { StyleContract } from "./types";

export function formatStyleContractForPrompt(
  contract: StyleContract | null,
  channel?: ContentChannel,
) {
  if (!contract) return "未确认个人写作风格。沿用账号品牌语气，但不要虚构个人经历。";

  const channelRules = channel ? contract.channelOverrides[channel] ?? [] : [];
  return [
    `风格档案: ${contract.profileName} v${contract.profileVersion}`,
    `创作者身份: ${contract.persona}`,
    `与读者关系: ${contract.readerRelationship}`,
    `价值观: ${contract.values.join("；")}`,
    `语气: ${contract.tone.join("；")}`,
    "必须遵守:",
    ...contract.hardRules.map((rule) => `- ${rule.instruction}`),
    "优先遵守:",
    ...contract.softRules.map((rule) => `- ${rule.instruction}`),
    `常用表达: ${contract.preferredPhrases.join("；") || "无"}`,
    `禁止表达: ${contract.bannedPhrases.join("；") || "无"}`,
    ...(channelRules.length ? ["本渠道规则:", ...channelRules.map((rule) => `- ${rule}`)] : []),
    ...(contract.temporaryInstructions.length ? [
      "本次临时风格要求:",
      ...contract.temporaryInstructions.map((rule) => `- ${rule}`),
    ] : []),
    "原文样例只用于学习语气、节奏和叙事，不得复用其中未经知识资料确认的事实:",
    ...contract.examples.slice(0, 3).map((example) => `- ${example.sourceTitle}: “${example.excerpt}”`),
  ].join("\n");
}
