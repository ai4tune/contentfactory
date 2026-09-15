import type { ContentPlan, ContentPlanItem } from "@/modules/plans/types";

export type TodayTask = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type WeeklyPlanProgress = {
  total: number;
  started: number;
  generated: number;
  published: number;
};

export function deriveTodayTask(plan: ContentPlan | null): TodayTask {
  if (!plan) {
    return {
      eyebrow: "今天先完成这件事",
      title: "生成第一份 30 天内容计划",
      description: "把企业目标拆成 3 到 5 个长期方向和本周 7 个优先选题。",
      actionLabel: "生成内容计划",
      href: "/plans",
    };
  }

  if (plan.status === "draft") {
    return {
      eyebrow: "今天先完成这件事",
      title: "确认本周 7 个优先选题",
      description: "检查标题、内容目的和推荐依据，确认后再开始生产内容。",
      actionLabel: "检查并确认计划",
      href: "/plans",
    };
  }

  const items = weekOneItems(plan);
  const generated = items.find((item) => item.status === "generated" && item.contentProjectId);
  if (generated) {
    return draftTask("审核", "已有内容生成完成，先完成人工审核，再安排下一篇。", generated);
  }
  const writing = items.find((item) => item.status === "writing" && item.contentProjectId);
  if (writing) {
    return draftTask("继续完成", "这篇内容已经开始，先把当前任务收口。", writing);
  }
  const pending = items.find((item) => item.status === "pending");
  if (pending) {
    return {
      eyebrow: "今天先完成这件事",
      title: `开始写《${shortTitle(pending.title)}》`,
      description: pending.rationale,
      actionLabel: "用这个选题开始创作",
      href: quickCreateHref(plan.id, pending),
    };
  }

  return {
    eyebrow: "本周计划已推进",
    title: "检查本周结果并安排下一步",
    description: "本周选题已经全部开始处理，可以回到计划页检查状态和后续选题。",
    actionLabel: "查看内容计划",
    href: "/plans",
  };
}

export function getWeeklyPlanProgress(plan: ContentPlan | null): WeeklyPlanProgress {
  const items = plan ? weekOneItems(plan) : [];
  return {
    total: items.length,
    started: items.filter((item) => item.status !== "pending").length,
    generated: items.filter((item) => ["generated", "published", "reviewed"].includes(item.status)).length,
    published: items.filter((item) => ["published", "reviewed"].includes(item.status)).length,
  };
}

export function quickCreateHref(planId: string, item: ContentPlanItem) {
  const query = new URLSearchParams({
    planId,
    planItemId: item.id,
    title: item.title,
  });
  return `/create/quick?${query.toString()}`;
}

function weekOneItems(plan: ContentPlan) {
  return plan.items
    .filter((item) => item.week === 1)
    .slice()
    .sort((left, right) => left.priority - right.priority);
}

function draftTask(action: "审核" | "继续完成", description: string, item: ContentPlanItem): TodayTask {
  return {
    eyebrow: "今天先完成这件事",
    title: `${action}《${shortTitle(item.title)}》`,
    description,
    actionLabel: action === "审核" ? "进入人工审核" : "继续当前内容",
    href: `/drafts/${encodeURIComponent(item.contentProjectId!)}`,
  };
}

function shortTitle(title: string) {
  return title.length > 30 ? `${title.slice(0, 29)}…` : title;
}
