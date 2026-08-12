import type { ContentProject } from "@/modules/content/types";
import type { ReviewIssue } from "./types";

const aiPatterns = [
  { phrase: "在当今这个快速发展的时代", replacement: "现在", title: "模板化时代开场" },
  { phrase: "值得注意的是", replacement: "其实", title: "模板化转折" },
  { phrase: "综上所述", replacement: "所以", title: "报告式收尾" },
  { phrase: "总而言之", replacement: "说到底", title: "报告式收尾" },
  { phrase: "一场前所未有的变革", replacement: "一次明显变化", title: "夸张式判断" },
  { phrase: "深度赋能", replacement: "提供具体帮助", title: "空泛能力词" },
] as const;

export function auditDeterministicStyle(project: ContentProject, content: string): ReviewIssue[] {
  const bannedPhrases = Array.from(new Set([
    ...(project.accountSnapshot?.bannedPhrases ?? []),
    ...(project.styleSnapshot?.bannedPhrases ?? []),
  ].map((item) => item.trim()).filter(Boolean)));
  const issues: ReviewIssue[] = [];

  bannedPhrases.forEach((phrase) => {
    if (!content.includes(phrase)) return;
    const pattern = aiPatterns.find((item) => item.phrase === phrase);
    issues.push(createIssue({
      phrase,
      replacement: pattern?.replacement,
      title: "命中已确认的禁用表达",
      description: `“${phrase}”来自当前账号或写作风格的禁用清单。`,
      severity: "medium",
    }, issues.length));
  });

  aiPatterns.forEach((pattern) => {
    if (!content.includes(pattern.phrase) || bannedPhrases.includes(pattern.phrase)) return;
    issues.push(createIssue({
      phrase: pattern.phrase,
      replacement: pattern.replacement,
      title: pattern.title,
      description: "这类固定搭配容易让内容显得像通用 AI 模板，建议换成更直接的口语表达。",
      severity: "low",
    }, issues.length));
  });

  return issues;
}

export function auditDeterministicHumanWriting(content: string): ReviewIssue[] {
  const patterns = [
    { phrase: "接下来让我们", title: "模型式路标", description: "这句在提示读者内容流程，但没有推进观点。可以直接进入下一段的具体判断。" },
    { phrase: "让我们一起来", title: "模型式邀请", description: "这类通用邀请容易削弱作者本人语气，建议直接说要讨论的事情。" },
    { phrase: "不难发现", title: "空泛结论", description: "这句话没有说明证据和推理过程，建议直接写出你观察到的具体变化。" },
    { phrase: "毋庸置疑", title: "无依据的确定判断", description: "强确定性表达需要材料支撑；没有证据时应改为可验证的具体判断。" },
  ] as const;

  return patterns.flatMap((pattern, index) => content.includes(pattern.phrase) ? [{
    id: `humanWritingRules_${Date.now()}_${index}`,
    category: "human_writing" as const,
    severity: "low" as const,
    title: pattern.title,
    description: pattern.description,
    originalText: pattern.phrase,
    suggestedText: "",
    autoFixable: false,
    requiresConfirmation: true,
    origin: "deterministic" as const,
    status: "open" as const,
  }] : []);
}

function createIssue(
  input: {
    phrase: string;
    replacement?: string;
    title: string;
    description: string;
    severity: ReviewIssue["severity"];
  },
  index: number,
): ReviewIssue {
  return {
    id: `reviewRules_${Date.now()}_${index}`,
    category: "style",
    severity: input.severity,
    title: input.title,
    description: input.description,
    originalText: input.phrase,
    suggestedText: input.replacement ?? "",
    autoFixable: Boolean(input.replacement),
    requiresConfirmation: !input.replacement,
    origin: "deterministic",
    status: "open",
  };
}
