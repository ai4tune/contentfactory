import type { ChannelDraft, PhotoSuggestion, PublicationDelivery } from "./types";

export function parsePublicationDelivery(value: Record<string, unknown>): PublicationDelivery | undefined {
  // 旧网关的 content-only 输出仍可读取，但不能声称已拆分发布内容。
  if (value.title === undefined) return undefined;
  const title = text(value.title, 200);
  if (!title) throw new Error("未生成最终标题，请重试。");
  return { title, titleOptions: list(value.titleOptions, 5, 200), summary: text(value.summary, 500), tags: list(value.tags, 8, 60).map((tag) => tag.replace(/^#+/, "")) };
}

export function parsePhotoSuggestions(value: unknown, sourceIds: string[]): PhotoSuggestion[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) throw new Error("实拍建议格式无效，请重试。");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("实拍建议格式无效，请重试。");
    const record = item as Record<string, unknown>;
    const suggestion = { purpose: text(record.purpose, 500), subject: text(record.subject, 500), how: text(record.how, 500), placement: text(record.placement, 500), fallback: text(record.fallback, 500), sourceIds: list(record.sourceIds, 12, 200) };
    if (!suggestion.purpose || !suggestion.subject || !suggestion.how || !suggestion.placement || !suggestion.fallback || !suggestion.sourceIds.length || suggestion.sourceIds.some((id) => !sourceIds.includes(id))) {
      throw new Error("实拍建议缺少可核对的资料或拍摄说明，请补充资料后重试。");
    }
    return suggestion;
  });
}

export function publicationBody(draft: Pick<ChannelDraft, "content" | "delivery" | "channel">) {
  const tags = draft.channel === "xiaohongshu_note" ? draft.delivery?.tags.filter((tag) => !draft.content.includes(`#${tag}`)) ?? [] : [];
  return [draft.content.trim(), ...(tags.length ? [tags.map((tag) => `#${tag}`).join(" ")] : [])].join("\n\n");
}

function text(value: unknown, limit: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > limit) throw new Error("发布信息格式无效或过长，请重试。");
  return value.trim();
}

function list(value: unknown, count: number, limit: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > count) throw new Error("发布信息列表格式无效，请重试。");
  return [...new Set(value.map((item) => text(item, limit)).filter(Boolean))];
}
