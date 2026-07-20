import { requireEnv } from "./config";
import type { KnowledgeSource } from "./feishu";
import type { AccountContext } from "@/modules/positioning/types";

export type GenerateRequest = {
  topic: string;
  audience?: string;
  platform?: string;
  accountPosition?: string;
  accountContext?: AccountContext;
  sources: KnowledgeSource[];
};

export type GenerateResult = {
  positioning: string;
  outline: string[];
  draft: string;
  audit: string[];
  citations: Array<{ title: string; reason: string }>;
};

export type PositioningRequest = {
  accountName: string;
  business: string;
  audience: string;
  offer: string;
  differentiator?: string;
  platforms?: string;
  goal?: string;
  currentContent?: string;
};

export type PositioningResult = {
  accountPosition: string;
  targetAudience: string[];
  contentPillars: string[];
  keywordSeeds: string[];
  benchmarkAccounts: string[];
  contentAngles: string[];
  brandVoice: string[];
  preferredPhrases: string[];
  bannedPhrases: string[];
  recommendedTopics: string[];
  analysisEvidence: string[];
  questionsToConfirm: string[];
  nextActions: string[];
};

export type TopicRadarRequest = {
  accountPosition: string;
  targetAudience?: string;
  offer?: string;
  platforms?: string;
  keywordSeeds?: string;
  hotSamples?: string;
  contentGoal?: string;
  accountContext?: AccountContext;
};

export type TopicRadarResult = {
  keywordGroups: Array<{ group: string; keywords: string[]; intent: string }>;
  searchTasks: Array<{ platform: string; query: string; why: string }>;
  hotSampleInsights: string[];
  topicCandidates: Array<{
    title: string;
    platform: string;
    angle: string;
    sourceKeyword: string;
    priority: string;
  }>;
  validationChecklist: string[];
  nextActions: string[];
};

export type InspirationRequest = {
  platform: string;
  sourceUrl?: string;
  title: string;
  metrics?: string;
  sourceKeyword?: string;
  content: string;
  accountPosition?: string;
};

export type InspirationResult = {
  summary: string;
  targetAudience: string;
  painPoint: string;
  hook: string;
  structure: string[];
  reusablePatterns: string[];
  keywords: string[];
  adaptationIdeas: string[];
  topicCandidates: string[];
  riskNotes: string[];
};

export async function generateContent(request: GenerateRequest): Promise<GenerateResult> {
  const context = request.sources
    .map((source, index) => {
      const text = (source.text ?? "").slice(0, 6000);
      return `[${index + 1}] ${source.title}\n来源: ${source.source}\n${text}`;
    })
    .join("\n\n");

  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容工厂的资深内容策略助手。只输出 JSON，不要 Markdown。JSON 字段必须包含 positioning, outline, draft, audit, citations。",
    },
    {
      role: "user",
      content: [
        `主题: ${request.topic}`,
        formatAccountContext(request.accountContext),
        `当前账号定位: ${request.accountPosition || request.accountContext?.accountPosition || "待补充"}`,
        `目标人群补充: ${request.audience || "无"}`,
        `平台: ${request.platform || "小红书/公众号/视频号"}`,
        "请结合资料输出第一版定位、大纲、草稿、审计建议和引用说明。",
        "资料:",
        context || "暂无资料，请明确指出需要补充知识库。",
      ].join("\n"),
    },
  ]);

  return normalizeGenerateResult(parseJsonObject(content) as Partial<GenerateResult>);
}

export async function analyzePositioning(request: PositioningRequest): Promise<PositioningResult> {
  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容工厂的账号定位顾问。只输出 JSON，不要 Markdown。JSON 字段必须包含 accountPosition, targetAudience, contentPillars, keywordSeeds, benchmarkAccounts, contentAngles, brandVoice, preferredPhrases, bannedPhrases, recommendedTopics, analysisEvidence, questionsToConfirm, nextActions。",
    },
    {
      role: "user",
      content: [
        `账号/品牌名: ${request.accountName}`,
        `业务类型: ${request.business}`,
        `目标客户: ${request.audience}`,
        `产品/服务: ${request.offer}`,
        `差异化优势: ${request.differentiator || "待补充"}`,
        `主要平台: ${request.platforms || "小红书/公众号/视频号"}`,
        `内容目标: ${request.goal || "获客、信任建设、成交转化"}`,
        `当前内容情况: ${request.currentContent || "暂无"}`,
        "请输出账号定位分析，重点帮助用户确定应该搜索哪些关键词、关注哪些爆款方向、先写哪些内容。",
      ].join("\n"),
    },
  ]);

  return normalizePositioningResult(parseJsonObject(content) as Partial<PositioningResult>);
}

export async function analyzeTopicRadar(request: TopicRadarRequest): Promise<TopicRadarResult> {
  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容工厂的选题雷达助手。只输出 JSON，不要 Markdown。JSON 字段必须包含 keywordGroups, searchTasks, hotSampleInsights, topicCandidates, validationChecklist, nextActions。",
    },
    {
      role: "user",
      content: [
        formatAccountContext(request.accountContext),
        `账号定位: ${request.accountPosition}`,
        `目标人群: ${request.targetAudience || "待补充"}`,
        `产品/服务: ${request.offer || "待补充"}`,
        `主要平台: ${request.platforms || "小红书、公众号、视频号"}`,
        `已有关键词种子: ${request.keywordSeeds || "暂无"}`,
        `内容目标: ${request.contentGoal || "获客、信任建设、成交转化"}`,
        "爆款样本/观察记录:",
        request.hotSamples || "暂无爆款样本，请先基于定位生成关键词池和搜索任务。",
        "请完成：1. 关键词分组；2. 每个平台该搜什么；3. 如果有爆款样本，拆解可复用洞察；4. 生成我们自己的选题候选；5. 给出验证清单和下一步。",
      ].join("\n"),
    },
  ]);

  return normalizeTopicRadarResult(parseJsonObject(content) as Partial<TopicRadarResult>);
}

export async function analyzeInspiration(request: InspirationRequest): Promise<InspirationResult> {
  const content = await chatCompletionJson([
    {
      role: "system",
      content:
        "你是内容工厂的爆款拆解助手。只输出 JSON，不要 Markdown。JSON 字段必须包含 summary, targetAudience, painPoint, hook, structure, reusablePatterns, keywords, adaptationIdeas, topicCandidates, riskNotes。structure 至少 5 条，reusablePatterns 至少 3 条，keywords 至少 5 条，topicCandidates 至少 5 条。",
    },
    {
      role: "user",
      content: [
        `平台: ${request.platform}`,
        `链接: ${request.sourceUrl || "未提供"}`,
        `标题: ${request.title}`,
        `数据: ${request.metrics || "未提供"}`,
        `来源关键词: ${request.sourceKeyword || "未提供"}`,
        `账号定位: ${request.accountPosition || "待补充"}`,
        "内容正文或摘要:",
        request.content,
        "请拆解这个爆款为什么有效、结构怎么复用、能转成哪些适合我们账号的选题。不要照抄原文，要指出可迁移方法。reusablePatterns 必须写成可执行的方法，例如“痛点开场 + 清单式避坑 + 真实案例证明”。",
      ].join("\n"),
    },
  ]);

  return normalizeInspirationResult(parseJsonObject(content) as Partial<InspirationResult>);
}

export async function chatCompletionJson(messages: Array<{ role: "system" | "user"; content: string }>) {
  const baseUrl = requireEnv("AI_BASE_URL");
  const apiKey = requireEnv("AI_API_KEY");
  const model = requireEnv("AI_MODEL");
  const url = normalizeChatCompletionsUrl(baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages,
    }),
    cache: "no-store",
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`AI gateway request failed: ${response.status} ${responseText.slice(0, 300)}`);
  }

  const content = readChatCompletionContent(responseText);

  if (!content) {
    throw new Error("AI gateway returned an empty response.");
  }

  return content;
}

function readChatCompletionContent(responseText: string): string | undefined {
  if (responseText.trim().startsWith("data:")) {
    return responseText
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.replace(/^data: /, "").trim())
      .filter((line) => line && line !== "[DONE]")
      .map((line) => {
        const chunk = JSON.parse(line) as {
          choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>;
        };

        return chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
      })
      .join("");
  }

  const payload = JSON.parse(responseText) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content;
}

function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

function normalizeGenerateResult(value: Partial<GenerateResult>): GenerateResult {
  return {
    positioning: String(value.positioning ?? ""),
    outline: Array.isArray(value.outline) ? value.outline.map(String) : [],
    draft: String(value.draft ?? ""),
    audit: Array.isArray(value.audit) ? value.audit.map(String) : [],
    citations: Array.isArray(value.citations)
      ? value.citations.map((citation) => ({
          title: String(citation.title ?? ""),
          reason: String(citation.reason ?? ""),
        }))
      : [],
  };
}

function normalizePositioningResult(value: Partial<PositioningResult>): PositioningResult {
  return {
    accountPosition: String(value.accountPosition ?? ""),
    targetAudience: toStringArray(value.targetAudience),
    contentPillars: toStringArray(value.contentPillars),
    keywordSeeds: toStringArray(value.keywordSeeds),
    benchmarkAccounts: toStringArray(value.benchmarkAccounts),
    contentAngles: toStringArray(value.contentAngles),
    brandVoice: toStringArray(value.brandVoice),
    preferredPhrases: toStringArray(value.preferredPhrases),
    bannedPhrases: toStringArray(value.bannedPhrases),
    recommendedTopics: toStringArray(value.recommendedTopics),
    analysisEvidence: toStringArray(value.analysisEvidence),
    questionsToConfirm: toStringArray(value.questionsToConfirm),
    nextActions: toStringArray(value.nextActions),
  };
}

function formatAccountContext(context?: AccountContext) {
  if (!context) return "当前账号上下文: 未确认（允许继续创作，不要虚构品牌事实）";

  return [
    "当前账号上下文:",
    `账号: ${context.accountName || "未命名"}`,
    `业务: ${context.business || "待补充"}`,
    `平台: ${context.platforms.join("、") || "待补充"}`,
    `定位: ${context.accountPosition || "待补充"}`,
    `目标人群: ${context.targetAudience.join("、") || "待补充"}`,
    `核心产品/服务: ${context.offer || "待补充"}`,
    `转化目标: ${context.conversionGoal || "待补充"}`,
    `内容支柱: ${context.contentPillars.join("、") || "待补充"}`,
    `品牌语气: ${context.brandVoice.join("、") || "待补充"}`,
    `常用表达: ${context.preferredPhrases.join("、") || "待补充"}`,
    `禁用表达: ${context.bannedPhrases.join("、") || "无"}`,
    `内容方向: ${context.contentDirections.join("、") || "待补充"}`,
  ].join("\n");
}

function normalizeTopicRadarResult(value: Partial<TopicRadarResult>): TopicRadarResult {
  return {
    keywordGroups: Array.isArray(value.keywordGroups)
      ? value.keywordGroups.map((item) => ({
          group: String(item.group ?? ""),
          keywords: toStringArray(item.keywords),
          intent: String(item.intent ?? ""),
        }))
      : [],
    searchTasks: Array.isArray(value.searchTasks)
      ? value.searchTasks.map((item) => ({
          platform: String(item.platform ?? ""),
          query: String(item.query ?? ""),
          why: String(item.why ?? ""),
        }))
      : [],
    hotSampleInsights: toStringArray(value.hotSampleInsights),
    topicCandidates: Array.isArray(value.topicCandidates)
      ? value.topicCandidates.map((item) => ({
          title: String(item.title ?? ""),
          platform: String(item.platform ?? ""),
          angle: String(item.angle ?? ""),
          sourceKeyword: String(item.sourceKeyword ?? ""),
          priority: String(item.priority ?? ""),
        }))
      : [],
    validationChecklist: toStringArray(value.validationChecklist),
    nextActions: toStringArray(value.nextActions),
  };
}

function normalizeInspirationResult(value: Partial<InspirationResult>): InspirationResult {
  const record = value as Partial<InspirationResult> & Record<string, unknown>;

  return {
    summary: String(value.summary ?? ""),
    targetAudience: String(value.targetAudience ?? ""),
    painPoint: String(value.painPoint ?? ""),
    hook: String(value.hook ?? ""),
    structure: firstStringArray(record, ["structure", "contentStructure", "outline"]),
    reusablePatterns: firstStringArray(record, [
      "reusablePatterns",
      "patterns",
      "reusableMethods",
      "transferablePatterns",
      "methods",
    ]),
    keywords: toStringArray(value.keywords),
    adaptationIdeas: toStringArray(value.adaptationIdeas),
    topicCandidates: toStringArray(value.topicCandidates),
    riskNotes: toStringArray(value.riskNotes),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function firstStringArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const items = toStringArray(record[key]);

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

export function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);

  return JSON.parse(fenced?.[1] ?? trimmed);
}
