import type { ContentPlan, ContentPlanItem } from "@/modules/plans/types";
import { defaultTimeZone, itemDate, localDate, weeklyItems } from "@/modules/plans/calendar";
import type { ContentPublication, DraftListItem } from "@/modules/drafts/types";

export type DashboardDraft = DraftListItem & { publications: ContentPublication[] };
export type TodayTask = { eyebrow: string; title: string; description: string; actionLabel: string; href: string };
export type TaskState = { label: string; actionLabel: string; href: string; completed: boolean; generated: boolean; approved: boolean; published: boolean };
export type WeeklyPlanProgress = { total: number; started: number; generated: number; approved: number; published: number; completed: number; paused: number };

export function draftTaskState(draft: DashboardDraft): TaskState {
  const href = `/drafts/${encodeURIComponent(draft.id)}`;
  const generated = draft.generatedChannels.length > 0;
  const approved = draft.reviewStatus === "approved";
  const published = draft.channels.length > 0 && draft.channels.every((channel) => draft.publications.some((publication) => publication.channel === channel));
  const common = { href, generated, approved, published, completed: published };
  if (published) return { ...common, label: "已发布", actionLabel: "查看发布与反馈" };
  if (draft.failedChannels.length || draft.projectStatus === "failed" || draft.projectStatus === "partially_failed") return { ...common, label: "生成失败，待重试", actionLabel: "查看并重试" };
  if (approved) return { ...common, label: "已审核，待发布", actionLabel: "发布并登记结果" };
  if (generated) return { ...common, label: "已生成，待人工审核", actionLabel: "审核正文与实拍建议" };
  return { ...common, label: "创作中", actionLabel: "继续创作" };
}

export function planItemState(plan: ContentPlan, item: ContentPlanItem, drafts: DashboardDraft[] = []): TaskState {
  const empty = { generated: false, approved: false, published: false, completed: false };
  const draft = drafts.find((draft) => draft.id === item.contentProjectId);
  if (item.status === "paused") return { ...(draft ? draftTaskState(draft) : empty), label: "已暂停", actionLabel: "调整或恢复任务", href: "/plans" };
  if ((item.taskType ?? "content") !== "content") {
    const completed = item.status === "completed";
    return { ...empty, completed, label: completed ? "已完成" : "待办", actionLabel: completed ? "查看任务" : item.taskType === "research" ? "打开调研入口" : item.taskType === "materials" ? "补充资料" : "查看并准备照片", href: completed ? "/plans" : item.taskType === "research" ? "/radar" : item.taskType === "materials" ? "/knowledge" : "/plans" };
  }
  if (draft) return draftTaskState(draft);
  if (item.contentProjectId || item.status !== "pending") return { ...empty, label: "内容记录待核对", actionLabel: "到内容库核对", href: "/articles" };
  return { ...empty, label: "待创作", actionLabel: "用这个选题开始创作", href: quickCreateHref(plan.id, item) };
}

export function deriveTodayTask(plan: ContentPlan | null, drafts: DashboardDraft[] = [], date = localDate(), timeZone = plan?.timeZone || defaultTimeZone): TodayTask {
  const eyebrow = "今天先完成这件事";
  const pausedDraftIds = new Set(plan?.items.filter((item) => item.status === "paused").map((item) => item.contentProjectId));
  const unfinished = drafts.find((draft) => !pausedDraftIds.has(draft.id) && !draftTaskState(draft).completed);
  if (unfinished) {
    const state = draftTaskState(unfinished);
    return { eyebrow, title: `${state.actionLabel}《${shortTitle(unfinished.topic)}》`, description: state.label === "已审核，待发布" ? "正文已经人工确认。复制到平台后，实际发布时再登记日期与链接；复制成功不会记为发布。" : state.label.includes("失败") ? "生成没有全部成功，已保存的正文保留。打开内容检查失败渠道，再决定是否重试。" : "先把已经开始的内容完成，核对正文与实拍建议，再安排发布。", actionLabel: state.actionLabel, href: state.href };
  }
  const feedback = drafts.find((draft) => !pausedDraftIds.has(draft.id) && draft.publications.some((publication) => localDate(new Date(publication.publishedAt), timeZone) < date && !publication.feedback));
  if (feedback) return { eyebrow, title: `记录《${shortTitle(feedback.topic)}》的发布反馈`, description: "已有实际发布记录，可以先填写阅读、互动或咨询反馈，看看是否达到本篇预期。", actionLabel: "登记发布反馈", href: `/drafts/${encodeURIComponent(feedback.id)}` };
  if (!plan || plan.status === "archived") return { eyebrow, title: "选一篇开始写", description: "可以用自己的想法或有依据的推荐选题先写一篇，暂时不需要制定计划。", actionLabel: "选口吻与选题", href: "/setup/first-content" };
  if (plan.status === "draft") return { eyebrow, title: "确认这份内容安排", description: `计划有 ${plan.items.length} 项安排。检查日期、选题和推荐依据，确认后再执行，也可以先单独写一篇。`, actionLabel: "检查并确认计划", href: "/plans" };
  const pending = plan.items.filter((item) => item.status !== "paused" && !planItemState(plan, item, drafts).completed)
    .slice().sort((a, b) => itemDate(plan, a).localeCompare(itemDate(plan, b)) || a.priority - b.priority)[0];
  if (pending) {
    const state = planItemState(plan, pending, drafts);
    const when = itemDate(plan, pending);
    return { eyebrow, title: (pending.taskType ?? "content") === "content" ? `${pending.status === "pending" ? "开始写" : state.actionLabel}《${shortTitle(pending.title)}》` : pending.title, description: `${when < date ? "原定安排尚未完成，先处理这项。" : when > date ? `下一项安排在 ${when}，今天可以提前准备。` : "这是今天的安排。"}${pending.rationale}`, actionLabel: state.actionLabel, href: state.href };
  }
  return { eyebrow: "下一步", title: plan.items.some((item) => item.status === "paused") ? "检查暂停的任务" : "本轮安排已完成，决定下一步", description: "可以查看结果、调整后续安排，或直接创作一个新的选题。", actionLabel: "查看并调整计划", href: "/plans" };
}

export function getWeeklyPlanProgress(plan: ContentPlan | null, drafts: DashboardDraft[] = [], date = localDate()): WeeklyPlanProgress {
  const items = plan ? weeklyItems(plan, date) : [];
  const states = plan ? items.map((item) => planItemState(plan, item, drafts)) : [];
  return {
    total: items.length,
    started: items.filter((item) => item.status !== "pending" && item.status !== "paused").length,
    generated: states.filter((state) => state.generated).length,
    approved: states.filter((state) => state.approved).length,
    published: states.filter((state) => state.published).length,
    completed: states.filter((state) => state.completed).length,
    paused: items.filter((item) => item.status === "paused").length,
  };
}

export function quickCreateHref(planId: string, item: ContentPlanItem) {
  const query = new URLSearchParams({ planId, planItemId: item.id, title: item.title });
  return `/create/quick?${query.toString()}`;
}

function shortTitle(title: string) { return title.length > 30 ? `${title.slice(0, 29)}…` : title; }
