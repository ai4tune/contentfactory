import { isContentChannel, type ContentChannel } from "@/modules/content/types";
import type { AccountContextDraft } from "@/modules/positioning/types";

export const interviewFields = ["accountName", "business", "goal", "offer", "audience", "differentiator", "boundaries", "tone"] as const;
export type InterviewField = (typeof interviewFields)[number];
export type InterviewAnswers = Record<InterviewField, string> & { primaryChannel?: ContentChannel };
export type InterviewPreview = { id: string; account: AccountContextDraft; confirmationStartedAt?: string; confirmedAt?: string };
export type InterviewState = { revision: number; step: number; answers: InterviewAnswers; preview: InterviewPreview | null };

export const emptyInterviewAnswers: InterviewAnswers = {
  accountName: "", business: "", goal: "", offer: "", audience: "", differentiator: "", boundaries: "", tone: "",
};

export class InterviewError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function parseInterviewAnswers(value: unknown, requireMinimum = false): InterviewAnswers {
  const record = asRecord(value);
  const answers: InterviewAnswers = { ...emptyInterviewAnswers };
  for (const field of interviewFields) {
    const value = record[field] ?? "";
    const limit = field === "accountName" ? 120 : 2000;
    if (typeof value !== "string" || value.length > limit) throw new InterviewError("回答格式不正确或内容过长，请精简后保存。");
    answers[field] = value.trim();
  }
  if (record.primaryChannel !== undefined && record.primaryChannel !== "") {
    if (!isContentChannel(record.primaryChannel)) throw new InterviewError("请选择支持的发布渠道。");
    answers.primaryChannel = record.primaryChannel;
  }
  if (requireMinimum && (!answers.accountName || !answers.business || !answers.goal || !answers.offer || !answers.primaryChannel)) {
    throw new InterviewError("请先补充名称、主营业务、这次目标、主推产品或服务，并选择发布渠道。");
  }
  return answers;
}

export function parseInterviewRevision(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0) throw new InterviewError("访谈版本无效，请刷新后继续。");
  return Number(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function interviewList(value: unknown, limit = 12): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 500)).filter(Boolean))].slice(0, limit) : [];
}
