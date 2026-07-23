import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import type { BriefKnowledgeSource, ContentBrief, ContentCitation } from "../types";
import { normalizeBriefList } from "./normalize-brief-list";

type RawBrief = Omit<ContentBrief, "citations"> & {
  citations?: Array<{ sourceId?: string; excerpt?: string; purpose?: string }>;
};

export async function createContentBrief(
  topic: string,
  account: AccountContext | null,
  sources: BriefKnowledgeSource[],
): Promise<ContentBrief> {
  const sourceContext = sources
    .map((source) => `[${source.id}] ${source.title}\n${source.text.slice(0, 6000)}`)
    .join("\n\n");
  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容策略编辑。只输出 JSON，字段必须包含 targetAudience, contentGoal, coreMessage, keyPoints, outline, callToAction, citations, openQuestions。citations 每项包含 sourceId, excerpt, purpose；excerpt 必须逐字摘自对应资料，不得虚构。把未知事实放进 openQuestions。",
    },
    {
      role: "user",
      content: [
        `选题: ${topic}`,
        `账号定位: ${account?.accountPosition || "未确认，不要虚构"}`,
        `目标人群: ${account?.targetAudience.join("、") || "待判断"}`,
        `产品/服务: ${account?.offer || "待判断"}`,
        `内容目标: ${account?.conversionGoal || "建立信任并推动下一步行动"}`,
        `品牌语气: ${account?.brandVoice.join("、") || "专业、清晰"}`,
        "已确认知识:",
        sourceContext,
      ].join("\n"),
    },
  ]);
  const raw = parseJsonObject(content) as Partial<RawBrief>;

  return {
    targetAudience: String(raw.targetAudience ?? "").trim(),
    contentGoal: String(raw.contentGoal ?? "").trim(),
    coreMessage: String(raw.coreMessage ?? "").trim(),
    keyPoints: normalizeBriefList(raw.keyPoints),
    outline: normalizeBriefList(raw.outline),
    callToAction: String(raw.callToAction ?? "").trim(),
    citations: normalizeCitations(raw.citations, sources),
    openQuestions: normalizeBriefList(raw.openQuestions),
  };
}

function normalizeCitations(
  citations: RawBrief["citations"],
  sources: BriefKnowledgeSource[],
): ContentCitation[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const normalized = (citations ?? []).flatMap((citation) => {
    const source = sourceMap.get(String(citation.sourceId ?? ""));
    if (!source) return [];
    const requestedExcerpt = String(citation.excerpt ?? "").trim();
    const excerpt = requestedExcerpt && source.text.includes(requestedExcerpt)
      ? requestedExcerpt
      : source.text.trim().slice(0, 260);

    return [{
      sourceId: source.id,
      sourceTitle: source.title,
      sourceType: source.source,
      excerpt,
      purpose: String(citation.purpose ?? "支撑核心观点").trim() || "支撑核心观点",
      url: source.url,
      path: source.path,
    }];
  });

  if (normalized.length) return normalized;

  return sources.map((source) => ({
    sourceId: source.id,
    sourceTitle: source.title,
    sourceType: source.source,
    excerpt: source.text.trim().slice(0, 260),
    purpose: "作为本次内容的事实依据",
    url: source.url,
    path: source.path,
  }));
}
