"use client";

import Link from "@/components/navigation-link";
import { AppShell, primaryButtonClass } from "@/components/app-shell";
import { channelLabels, type ContentChannel } from "@/modules/content/types";
import type { DashboardSummary } from "@/modules/dashboard/server/summary";
import { getWeeklyPlanProgress, planItemState, draftTaskState } from "@/modules/dashboard/task";
import { deriveAgentGuidance, type AgentAction } from "@/modules/agent/next-action";
import { calendarWeek, defaultTimeZone, weeklyItems } from "@/modules/plans/calendar";
import { useLocalDate } from "@/modules/plans/use-local-date";
import { planTaskLabels } from "@/modules/plans/types";
import { AgentCommandBar } from "@/modules/agent/components/agent-command-bar";

export function AgentWorkspace({
  primaryChannel,
  businessName,
  summary,
}: {
  primaryChannel?: ContentChannel;
  businessName?: string;
  summary: DashboardSummary;
}) {
  const plan = summary.contentPlan;
  const today = useLocalDate(summary.today, plan?.timeZone);
  const timeZone = plan?.timeZone || (typeof window === "undefined" ? defaultTimeZone : Intl.DateTimeFormat().resolvedOptions().timeZone);
  const guidance = deriveAgentGuidance(plan, summary.drafts, today, timeZone);
  const progress = getWeeklyPlanProgress(plan, summary.drafts, today);
  const week = calendarWeek(today);
  const tasks = plan ? weeklyItems(plan, today) : [];
  const accountName = businessName || summary.account?.accountName || "当前企业";

  return (
    <AppShell active="/">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald-800">AI 工作台</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            你好，{accountName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">今天是 {today}。看看本周安排，先完成一件事。</p>
        </div>
        <Link className="text-sm font-semibold text-emerald-900 underline decoration-emerald-900/20 underline-offset-4 hover:decoration-emerald-900" href="/plans">
          调整计划
        </Link>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl bg-[#173e32] text-white shadow-[0_24px_70px_rgba(18,35,29,0.13)]">
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#dfb967] text-xs font-bold text-[#173e32]">AI</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#dfb967]">今天先做什么</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">{guidance.observation}</p>
                </div>
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">
                <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">{guidance.primary.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">{guidance.primary.description}</p>
                <Link className={`${primaryButtonClass} mt-6 bg-[#dfb967] text-[#173e32] hover:bg-[#e8c87f]`} href={guidance.primary.href}>
                  {guidance.primary.actionLabel}
                </Link>
              </div>
            </div>

            <div className="grid border-t border-white/10 md:grid-cols-2">
              {guidance.alternatives.map((action, index) => (
                <AlternativeAction action={action} border={index > 0} key={action.id} />
              ))}
            </div>
          </section>

          <AgentCommandBar
            hasConfirmedPlan={plan?.status === "confirmed"}
            primaryHref={guidance.primary.href}
          />
        </div>

        <aside className="min-w-0 space-y-5">

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">本周安排</h2>
              <Link className="text-xs font-semibold text-emerald-800" href="/plans">调整安排</Link>
            </div>
            <p className="mt-2 text-xs text-slate-500">{week.start} 至 {week.end}</p>
            {plan ? <>
              <p className="mt-4 text-sm leading-6 text-slate-600">{plan.operatingGoal}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <ProgressMetric label="本周安排" value={progress.total} />
                <ProgressMetric label="已完成" value={progress.completed} />
                <ProgressMetric label="内容已生成" value={progress.generated} />
                <ProgressMetric label="内容已审核" value={progress.approved} />
                <ProgressMetric label="实际已发布" value={progress.published} />
                <ProgressMetric label="已暂停" value={progress.paused} />
              </div>
              <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                {tasks.slice(0, 5).map((item) => {
                  const state = planItemState(plan, item, summary.drafts);
                  return <li className="py-3" key={item.id}>
                    <p className="text-xs text-slate-500">{item.scheduledDate || `第 ${item.week} 周，未定具体日期`} · {planTaskLabels[item.taskType ?? "content"]} · {state.label}</p>
                    <Link className="mt-1 block break-words text-sm font-semibold text-slate-900 hover:text-emerald-800" href={plan.status === "draft" ? "/plans" : state.href}>{item.title}</Link>
                  </li>;
                })}
              </ul>
              {!tasks.length ? <p className="mt-4 text-sm leading-6 text-slate-500">本周没有安排。可以继续过去未完成的内容，或按自己的节奏写一篇。</p> : null}
              {tasks.length > 5 ? <Link className="mt-3 block text-xs font-semibold text-emerald-800" href="/plans">查看其余 {tasks.length - 5} 项安排</Link> : null}
            </> : <>
              <p className="mt-4 text-sm leading-6 text-slate-500">暂未制定计划，也可以直接写内容。需要安排工作量时，再选择 7 天或 30 天计划。</p>
              <Link className="mt-4 inline-block text-sm font-semibold text-emerald-800" href="/plans">安排接下来 7 天 →</Link>
            </>}
            <p className="mt-4 text-xs leading-5 text-slate-400">已完成指手动完成的运营任务或实际发布的内容。审核、复制不会记为发布。</p>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">当前目标与参考资料</summary>
            <dl className="mt-5 grid gap-4">
              <ContextRow label="当前经营目标" value={plan?.operatingGoal || summary.account?.conversionGoal || "先介绍真实业务，长期目标可后补"} />
              <ContextRow label="主渠道" value={plan ? channelLabels[plan.primaryChannel] : primaryChannel ? channelLabels[primaryChannel] : "待确认"} />
              <ContextRow label="计划状态" value={plan ? planStatusLabel(plan.status) : "尚未生成"} />
            </dl>
          </details>

        </aside>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">最近进展</h2>
            <p className="mt-1 text-xs text-slate-500">查看已完成、等待处理或失败的内容，直接接着做。</p>
          </div>
          <Link className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950" href="/articles">全部内容</Link>
        </div>
        {summary.drafts.length ? (
          <div className="grid border-t border-slate-100 md:grid-cols-2 xl:grid-cols-3">
            {summary.drafts.slice(0, 6).map((draft) => (
              <Link
                className="group min-w-0 border-b border-slate-100 px-5 py-5 transition hover:bg-slate-50 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0"
                href={`/drafts/${encodeURIComponent(draft.id)}`}
                key={draft.id}
              >
                <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-900">{draft.topic}</h3>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{draftTaskState(draft).label}</span>
                  <span>{formatDate(draft.updatedAt, timeZone)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-t border-slate-100 px-5 py-8 text-sm leading-6 text-slate-500 sm:px-6">
            还没有内容项目。完成上方首要任务后，第一篇内容会出现在这里。
          </div>
        )}
      </section>
    </AppShell>
  );
}

function AlternativeAction({ action, border }: { action: AgentAction; border: boolean }) {
  return (
    <Link
      className={`group px-5 py-5 transition hover:bg-white/5 sm:px-7 ${border ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}
      href={action.href}
    >
      <p className="text-sm font-semibold text-white/90 group-hover:text-white">{action.title}</p>
      <p className="mt-2 text-xs leading-5 text-white/50">{action.description}</p>
      <p className="mt-3 text-xs font-semibold text-[#dfb967]">{action.actionLabel} →</p>
    </Link>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-slate-700">{value}</dd>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function formatDate(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timeZone || "Asia/Shanghai", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function planStatusLabel(status: "draft" | "confirmed" | "archived") {
  if (status === "confirmed") return "已确认，可以开始创作";
  if (status === "archived") return "已归档";
  return "待确认";
}
