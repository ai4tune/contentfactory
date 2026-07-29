import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { AccountContext } from "@/modules/positioning/types";
import type {
  BriefKnowledgeSource,
  ContentBrief,
  ContentCitation,
  ContentInspirationReference,
} from "../types";
import { normalizeBriefList } from "./normalize-brief-list";

type RawBrief = Omit<ContentBrief, "citations"> & {
  citations?: Array<{ sourceId?: string; excerpt?: string; purpose?: string }>;
};

export async function createContentBrief(
  topic: string,
  account: AccountContext | null,
  sources: BriefKnowledgeSource[],
  inspiration: ContentInspirationReference | null = null,
): Promise<ContentBrief> {
  const sourceContext = sources
    .map((source) => `[${source.id}] ${source.title}\n${source.text.slice(0, 6000)}`)
    .join("\n\n");
  const content = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是内容策略编辑。只输出 JSON，字段必须包含 targetAudience, contentGoal, coreMessage, keyPoints, outline, callToAction, citations, openQuestions。",
        "citations 每项包含 sourceId, excerpt, purpose；excerpt 必须逐字摘自对应知识资料，不得虚构。没有知识资料时 citations 返回空数组，把未知事实放进 openQuestions。",
        "如果提供爆款参考，只学习它的受众洞察、开头钩子、内容结构、节奏和互动设计。不得照抄原文句子，不得继承原文中的数据、案例、产品事实或承诺。",
        "知识资料是事实和案例的优先来源；爆款参考不是事实证据。",
      ].join("\n"),
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
        "爆款参考:",
        inspiration ? JSON.stringify(inspiration, null, 2) : "未选择，按原创模式生成。",
        "已确认知识:",
        sourceContext || "本次未选择知识资料，不得虚构事实、案例和数据。",
      ].join("\n"),
    },
  ]);
  const raw = parseJsonObject(content) as Partial<RawBrief>;
  const outline = normalizeBriefList(raw.outline);
  const keyPoints = normalizeBriefList(raw.keyPoints);

  return {
    targetAudience: String(raw.targetAudience ?? "").trim(),
    contentGoal: String(raw.contentGoal ?? "").trim(),
    coreMessage: String(raw.coreMessage ?? "").trim(),
    keyPoints: keyPoints.length ? keyPoints : inspiration?.reusablePatterns ?? [],
    outline: outline.length ? outline : inspiration?.structure ?? [],
    callToAction: String(raw.callToAction ?? "").trim(),
    citations: normalizeCitations(raw.citations, sources),
    openQuestions: normalizeBriefList(raw.openQuestions),
    inspiration: inspiration ?? undefined,
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
