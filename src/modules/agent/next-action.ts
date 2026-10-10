import { deriveTodayTask, type DashboardDraft } from "@/modules/dashboard/task";
import type { ContentPlan } from "@/modules/plans/types";
import { defaultTimeZone, localDate } from "@/modules/plans/calendar";

export type AgentAction = { id: string; title: string; description: string; actionLabel: string; href: string };
export type AgentGuidance = { observation: string; primary: AgentAction; alternatives: AgentAction[] };

export function deriveAgentGuidance(plan: ContentPlan | null, drafts: DashboardDraft[] = [], date = localDate(), timeZone = plan?.timeZone || defaultTimeZone): AgentGuidance {
  const task = deriveTodayTask(plan, drafts, date, timeZone);
  const primary = { id: "primary", ...task };
  const candidates: AgentAction[] = [
    { id: "new-content", title: "我有一个新选题", description: "临时想法也能直接写，不需要先加入计划。", actionLabel: "写一篇内容", href: "/setup/first-content" },
    { id: "plan", title: plan ? "调整内容安排" : "安排接下来 7 天", description: "选择周期与每周发布频率，按自己的工作量安排。", actionLabel: "查看计划", href: "/plans" },
    { id: "library", title: "查看已有内容", description: "旧资料、草稿和发布记录仍可从内容库继续。", actionLabel: "打开内容库", href: "/articles" },
  ];
  return {
    observation: `按 ${date} 的安排和已保存的内容进度，建议先处理这一项。`,
    primary,
    alternatives: candidates.filter((action) => action.href !== primary.href).slice(0, 2),
  };
}
