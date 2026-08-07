import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import type { AccountContext } from "@/modules/positioning/types";
import { formatStyleContractForPrompt } from "@/modules/style-profile/prompt";
import type { StyleContract } from "@/modules/style-profile/types";
import type { TopicSuggestion } from "./types";

export async function suggestTopics(
  account: AccountContext | null,
  sources: BriefKnowledgeSource[],
  styleContract: StyleContract | null = null,
): Promise<TopicSuggestion[]> {
  const sourceContext = sources
    .map((source) => `[${source.id}] ${source.title}\n${source.text.slice(0, 3500)}`)
    .join("\n\n");
  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容选题编辑。只输出 JSON，字段为 suggestions；每项包含 title, angle, rationale, sourceIds。给出 3 个不依赖爆款样本、能被资料支撑的具体选题。sourceIds 只能使用输入中的来源 ID。",
    },
    {
      role: "user",
      content: [
        `账号定位: ${account?.accountPosition || "未确认"}`,
        `目标人群: ${account?.targetAudience.join("、") || "待判断"}`,
        `产品/服务: ${account?.offer || "待判断"}`,
        `内容方向: ${account?.contentDirections.join("、") || "待判断"}`,
        "写作风格约束:",
        formatStyleContractForPrompt(styleContract),
        "已选知识:",
        sourceContext,
      ].join("\n"),
    },
  ]);
  const parsed = parseJsonObject(content) as { suggestions?: Array<Partial<TopicSuggestion>> };
  const sourceIds = new Set(sources.map((source) => source.id));

  return (parsed.suggestions ?? [])
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      angle: String(item.angle ?? "").trim(),
      rationale: String(item.rationale ?? "").trim(),
      sourceIds: Array.isArray(item.sourceIds)
        ? item.sourceIds.map(String).filter((id) => sourceIds.has(id))
        : [],
    }))
    .filter((item) => item.title)
    .slice(0, 3);
}
