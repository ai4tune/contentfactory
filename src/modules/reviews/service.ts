import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { channelLabels, type ChannelDraft, type ContentProject } from "@/modules/content/types";
import { formatStyleContractForPrompt } from "@/modules/style-profile/prompt";
import { auditDeterministicHumanWriting, auditDeterministicStyle } from "./deterministic-audit";
import {
  isReviewIssueCategory,
  isReviewRiskLevel,
  type ChannelReview,
  type ReviewIssue,
  type ReviewRiskLevel,
} from "./types";

type ReviewChannelInput = {
  project: ContentProject;
  draft: ChannelDraft;
  humanWritingQa?: boolean;
};

export async function reviewChannelDraft(input: ReviewChannelInput): Promise<ChannelReview> {
  const humanWritingQa = input.humanWritingQa === true;
  const deterministicIssues = [
    ...auditDeterministicStyle(input.project, input.draft.content),
    ...(humanWritingQa ? auditDeterministicHumanWriting(input.draft.content) : []),
  ];
  try {
    const response = await chatCompletionJson([
      {
        role: "system",
        content: [
          "你是内容工厂的独立审核员，只审核，不重写整篇内容。只输出 JSON，不要 Markdown。",
          `必须检查三类问题：fact（事实）、style（账号风格）、platform（平台风险）${humanWritingQa ? "，并执行 human_writing（Human Writing 专项检查）" : ""}。只列真实存在的问题，不要凑数。`,
          `输出结构：{\"conclusion\":\"\",\"riskLevel\":\"low|medium|high|blocked\",\"issues\":[{\"category\":\"fact|style|platform${humanWritingQa ? "|human_writing" : ""}\",\"severity\":\"low|medium|high|blocked\",\"title\":\"\",\"description\":\"\",\"originalText\":\"\",\"suggestedText\":\"\",\"autoFixable\":true,\"requiresConfirmation\":false}]}。`,
          "originalText 必须逐字摘自待审稿件并能精确定位。只有不改变事实含义且可安全替换时 autoFixable 才能为 true。",
          "缺乏知识证据的事实不得自行补全：标记 requiresConfirmation=true、autoFixable=false。",
          "当简报包含爆款参考时，额外检查是否照抄原文表达（归为 style）或错误继承原文事实、数据和案例（归为 fact）。",
          "确定性禁用词检查由系统单独执行。你只补充需要语义判断的问题，不重复列出明显禁用词。",
          ...(humanWritingQa ? [
            "Human Writing 专项检查只针对：材料不足却强行展开、关键事实没有来源、段落没有新增信息、重复空话、模型式路标或报告腔。",
            "不要因为文章口语化、使用第一人称或具有作者个人习惯就判错；已确认的风格档案和代表片段优先于通用写作偏好。",
            "指出问题时必须引用待审稿件中的原文，并说明它为什么降低可发布性；不得为了显得严格而凑问题。",
          ] : []),
        ].join("\n"),
      },
      { role: "user", content: buildReviewContext(input) },
    ]);
    const aiReview = normalizeReview(parseJsonObject(response), input.draft.content, humanWritingQa);
    const issues = dedupeIssues([...deterministicIssues, ...aiReview.issues]);
    return {
      ...aiReview,
      humanWritingQa,
      conclusion: deterministicIssues.length
        ? `规则检查发现 ${deterministicIssues.length} 项；${aiReview.conclusion}`
        : aiReview.conclusion,
      riskLevel: highestRisk([aiReview.riskLevel, ...issues.map((issue) => issue.severity)]),
      issues,
    };
  } catch {
    return {
      conclusion: deterministicIssues.length
        ? `已完成规则检查，发现 ${deterministicIssues.length} 项。AI 语义复核暂时不可用。`
        : "规则检查未发现问题，AI 语义复核暂时不可用。",
      riskLevel: highestRisk(deterministicIssues.map((issue) => issue.severity)),
      issues: deterministicIssues,
      humanWritingQa,
      reviewedContent: input.draft.content,
      reviewedAt: new Date().toISOString(),
    };
  }
}

function buildReviewContext({ project, draft }: ReviewChannelInput) {
  const citations = project.selectedKnowledgeRefs.length
    ? project.selectedKnowledgeRefs.map((citation, index) => [
        `[${index + 1}] ${citation.sourceTitle}`,
        `摘录：${citation.excerpt}`,
        `用途：${citation.purpose}`,
      ].join("\n")).join("\n\n")
    : "没有可用知识证据。";

  return [
    `审核渠道：${channelLabels[draft.channel]}`,
    "【账号定位】",
    project.accountSnapshot ? JSON.stringify(project.accountSnapshot, null, 2) : "未确认，不得虚构账号事实或风格。",
    "【统一内容简报】",
    JSON.stringify(project.brief, null, 2),
    "【已确认写作风格】",
    formatStyleContractForPrompt(project.styleSnapshot, draft.channel),
    "【知识引用】",
    citations,
    "【待审稿件】",
    draft.content,
  ].join("\n\n");
}

function normalizeReview(value: unknown, content: string, humanWritingQa: boolean): ChannelReview {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const issues = Array.isArray(record.issues)
    ? record.issues.flatMap((item, index) => normalizeIssue(item, content, index, humanWritingQa)).slice(0, 20)
    : [];
  const requestedRisk = isReviewRiskLevel(record.riskLevel) ? record.riskLevel : "low";

  return {
    conclusion: limitedString(record.conclusion, 600) || (issues.length ? "发现需要处理的审核问题。" : "未发现需要修改的问题。"),
    riskLevel: highestRisk([requestedRisk, ...issues.map((issue) => issue.severity)]),
    issues,
    humanWritingQa: false,
    reviewedContent: content,
    reviewedAt: new Date().toISOString(),
  };
}

function normalizeIssue(value: unknown, content: string, index: number, humanWritingQa: boolean): ReviewIssue[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (!isReviewIssueCategory(record.category)) return [];
  if (record.category === "human_writing" && !humanWritingQa) return [];

  const title = limitedString(record.title, 120);
  const description = limitedString(record.description, 600);
  if (!title || !description) return [];

  const originalText = limitedString(record.originalText, 800);
  const suggestedText = limitedString(record.suggestedText, 1_500);
  const requiresConfirmation = record.requiresConfirmation === true;
  const autoFixable = record.autoFixable === true
    && !requiresConfirmation
    && Boolean(originalText)
    && Boolean(suggestedText)
    && content.includes(originalText);

  return [{
    id: `reviewIssues_${Date.now()}_${index}`,
    category: record.category,
    severity: isReviewRiskLevel(record.severity) ? record.severity : "medium",
    title,
    description,
    originalText,
    suggestedText,
    autoFixable,
    requiresConfirmation,
    origin: "ai",
    status: "open",
  }];
}

function dedupeIssues(issues: ReviewIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.category}:${issue.originalText}:${issue.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function limitedString(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

function highestRisk(levels: ReviewRiskLevel[]): ReviewRiskLevel {
  const order: ReviewRiskLevel[] = ["low", "medium", "high", "blocked"];
  return levels.reduce((highest, level) => order.indexOf(level) > order.indexOf(highest) ? level : highest, "low");
}
