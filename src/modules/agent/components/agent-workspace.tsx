import Link from "next/link";
import { AppShell, primaryButtonClass } from "@/components/app-shell";
import { channelLabels, type ContentChannel } from "@/modules/content/types";
import type { DashboardSummary } from "@/modules/dashboard/server/summary";
import { getWeeklyPlanProgress } from "@/modules/dashboard/task";
import { deriveAgentGuidance, type AgentAction } from "@/modules/agent/next-action";
import { AgentCommandBar } from "@/modules/agent/components/agent-command-bar";

export function AgentWorkspace({
  primaryChannel,
  summary,
}: {
  primaryChannel?: ContentChannel;
  summary: DashboardSummary;
}) {
  const plan = summary.contentPlan;
  const guidance = deriveAgentGuidance(plan);
  const progress = getWeeklyPlanProgress(plan);
  const accountName = summary.account?.accountName || "当前企业";

  return (
    <AppShell active="/">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald-800">AI 工作台</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            你好，{accountName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">我会根据真实进度告诉你下一步，并把结果带回原有工作流。</p>
        </div>
        <Link className="text-sm font-semibold text-emerald-900 underline decoration-emerald-900/20 underline-offset-4 hover:decoration-emerald-900" href="/plans">
          查看完整计划
        </Link>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl bg-[#173e32] text-white shadow-[0_24px_70px_rgba(18,35,29,0.13)]">
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#dfb967] text-xs font-bold text-[#173e32]">AI</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#dfb967]">我建议先做这件事</p>
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
            <h2 className="text-base font-semibold text-slate-900">这次判断参考了什么</h2>
            <dl className="mt-5 grid gap-4">
              <ContextRow label="当前经营目标" value={plan?.operatingGoal || summary.account?.conversionGoal || "待生成内容计划"} />
              <ContextRow label="主渠道" value={plan ? channelLabels[plan.primaryChannel] : primaryChannel ? channelLabels[primaryChannel] : "待确认"} />
              <ContextRow label="计划状态" value={plan ? planStatusLabel(plan.status) : "尚未生成"} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">本周进度</h2>
              <Link className="text-xs font-semibold text-emerald-800 hover:text-emerald-950" href="/plans">查看计划</Link>
            </div>
            {plan ? (
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
                <ProgressMetric label="选题" value={progress.total} />
                <ProgressMetric label="已开始" value={progress.started} />
                <ProgressMetric label="已生成" value={progress.generated} />
                <ProgressMetric label="已发布" value={progress.published} />
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">生成首份计划后，这里会显示真实推进状态。</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">系统已经掌握</h2>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
              <ProgressMetric label="知识资料" value={summary.serverKnowledgeCount} />
              <ProgressMetric label="内容项目" value={summary.contentProjectCount} />
              <ProgressMetric label="人工确认" value={summary.approvedContentCount} />
              <ProgressMetric label="已发布" value={summary.publishedContentCount} />
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">最近继续过的内容</h2>
            <p className="mt-1 text-xs text-slate-500">需要接着做时，可以直接从这里返回。</p>
          </div>
          <Link className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950" href="/articles">全部内容</Link>
        </div>
        {summary.recentDrafts.length ? (
          <div className="grid border-t border-slate-100 md:grid-cols-2 xl:grid-cols-3">
            {summary.recentDrafts.slice(0, 3).map((draft) => (
              <Link
                className="group min-w-0 border-b border-slate-100 px-5 py-5 transition hover:bg-slate-50 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0"
                href={`/drafts/${encodeURIComponent(draft.id)}`}
                key={draft.id}
              >
                <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-900">{draft.topic}</h3>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{reviewStatusLabel(draft.reviewStatus)}</span>
                  <span>{formatDate(draft.updatedAt)}</span>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function reviewStatusLabel(status: "draft" | "editing" | "approved") {
  if (status === "approved") return "已确认";
  if (status === "editing") return "编辑中";
  return "待人工审核";
}

function planStatusLabel(status: "draft" | "confirmed" | "archived") {
  if (status === "confirmed") return "已确认，可以开始创作";
  if (status === "archived") return "已归档";
  return "待确认";
}
