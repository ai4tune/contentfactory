import { channelLabels, type ContentChannel } from "@/modules/content/types";
import type { ContentDraft } from "../types";

export function renderDraftMarkdown(draft: ContentDraft, channel?: ContentChannel) {
  const channelDrafts = channel
    ? draft.channelDrafts.filter((item) => item.channel === channel)
    : draft.channelDrafts;

  return [
    `# ${draft.topic}`,
    "",
    `- 创建时间：${draft.createdAt}`,
    `- 最后修改：${draft.updatedAt}`,
    `- 审核状态：${draft.reviewStatus}`,
    "",
    "## 内容简报",
    "",
    `- 目标受众：${draft.brief.targetAudience}`,
    `- 内容目标：${draft.brief.contentGoal}`,
    `- 核心观点：${draft.brief.coreMessage}`,
    `- 行动引导：${draft.brief.callToAction}`,
    "",
    "### 关键论点",
    "",
    ...toMarkdownList(draft.brief.keyPoints),
    "",
    "### 内容结构",
    "",
    ...toMarkdownList(draft.brief.outline),
    "",
    "## 引用来源",
    "",
    ...(draft.brief.citations.length
      ? draft.brief.citations.flatMap((citation) => [
          `### ${citation.sourceTitle}`,
          "",
          `> ${citation.excerpt}`,
          "",
          `用途：${citation.purpose}`,
          "",
        ])
      : ["暂无引用。", ""]),
    ...channelDrafts.flatMap((item) => [
      `## ${channelLabels[item.channel]}`,
      "",
      item.status === "failed" ? `生成失败：${item.error || "未知错误"}` : item.content,
      "",
    ]),
  ].join("\n");
}

function toMarkdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ["- 暂无"];
}
