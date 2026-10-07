import { deriveTodayTask, quickCreateHref } from "@/modules/dashboard/task";
import type { ContentPlan } from "@/modules/plans/types";

export type AgentAction = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type AgentGuidance = {
  observation: string;
  primary: AgentAction;
  alternatives: AgentAction[];
};

export function deriveAgentGuidance(plan: ContentPlan | null): AgentGuidance {
  const todayTask = deriveTodayTask(plan);
  const primary: AgentAction = {
    id: "primary",
    title: todayTask.title,
    description: todayTask.description,
    actionLabel: todayTask.actionLabel,
    href: todayTask.href,
  };

  if (!plan) {
    const firstContent: AgentAction = { id: "primary", title: "选一篇开始写", description: "沿用已有口吻，或比较三个例稿，再从有依据的选题开始。", actionLabel: "选口吻与选题", href: "/setup/first-content" };
    return {
      observation: "经营信息已经确认，可以先完成一篇内容，再按需要制定完整计划。",
      primary: firstContent,
      alternatives: uniqueAlternatives(firstContent, [
        { id: "plan", title: "完整内容计划", description: "需要安排一段时间的内容时再制定计划。", actionLabel: "查看计划", href: "/plans" },
        brandAction(),
        libraryAction(),
      ]),
    };
  }

  if (plan.status === "draft") {
    return {
      observation: "30 天内容计划已经生成，但本周选题还没有确认。现在先做一次方向判断最合适。",
      primary,
      alternatives: uniqueAlternatives(primary, [
        brandAction(),
        libraryAction(),
      ]),
    };
  }

  const weekItems = plan.items
    .filter((item) => item.week === 1)
    .slice()
    .sort((left, right) => left.priority - right.priority);
  const nextPending = weekItems.find((item) => item.status === "pending");
  const alternatives: AgentAction[] = [];

  if (nextPending && primary.href !== quickCreateHref(plan.id, nextPending)) {
    alternatives.push({
      id: `plan-item-${nextPending.id}`,
      title: `开始《${shortTitle(nextPending.title)}》`,
      description: "如果当前任务不紧急，也可以直接推进本周的下一条选题。",
      actionLabel: "开始创作",
      href: quickCreateHref(plan.id, nextPending),
    });
  }

  alternatives.push({
    id: "plan",
    title: "检查本周内容安排",
    description: "查看所有选题、发布节奏和当前完成状态。",
    actionLabel: "查看计划",
    href: "/plans",
  });
  alternatives.push(libraryAction());

  return {
    observation: observationFor(primary, nextPending?.title),
    primary,
    alternatives: uniqueAlternatives(primary, alternatives),
  };
}

function observationFor(primary: AgentAction, nextPendingTitle?: string) {
  if (primary.href.startsWith("/drafts/")) {
    return nextPendingTitle
      ? `我检查了本周进度。先把已经开始的内容收口，再推进《${shortTitle(nextPendingTitle)}》，整体节奏最稳。`
      : "我检查了本周进度。现在最重要的是把已经开始的内容收口。";
  }
  if (primary.href.startsWith("/create/quick")) {
    return "我检查了本周计划和已有内容。当前没有等待处理的草稿，可以开始下一条选题。";
  }
  return "我检查了本周计划。当前内容都已经开始处理，适合回顾结果并安排下一轮。";
}

function uniqueAlternatives(primary: AgentAction, actions: AgentAction[]) {
  const seen = new Set([primary.href]);
  return actions.filter((action) => {
    if (seen.has(action.href)) return false;
    seen.add(action.href);
    return true;
  }).slice(0, 2);
}

function brandAction(): AgentAction {
  return {
    id: "brand",
    title: "补充企业资料",
    description: "更新定位、知识和写作风格，让后续内容更贴近真实业务。",
    actionLabel: "查看资料",
    href: "/brand",
  };
}

function libraryAction(): AgentAction {
  return {
    id: "library",
    title: "查看最近内容",
    description: "继续编辑已有草稿，或者补记发布结果。",
    actionLabel: "打开内容库",
    href: "/articles",
  };
}

function shortTitle(title: string) {
  return title.length > 24 ? `${title.slice(0, 23)}…` : title;
}
