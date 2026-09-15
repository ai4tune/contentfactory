import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AppShell,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/app-shell";
import { channelLabels } from "@/modules/content/types";
import { KnowledgeMaterialStat } from "@/modules/dashboard/components/knowledge-material-stat";
import { getDashboardSummary } from "@/modules/dashboard/server/summary";
import { deriveTodayTask, getWeeklyPlanProgress } from "@/modules/dashboard/task";
import { getOnboardingSnapshot } from "@/modules/onboarding/service";

export const dynamic = "force-dynamic";

const secondaryActions = [
  { title: "企业资料", description: "补充知识、定位和写作风格", href: "/brand", mark: "企" },
  { title: "高级创作", description: "指定资料、多渠道或爆款改写", href: "/create", mark: "高" },
  { title: "内容库", description: "审核内容并记录发布结果", href: "/articles", mark: "库" },
];

export default async function DashboardPage() {
  const [onboarding, summary] = await Promise.all([
    getOnboardingSnapshot(),
    getDashboardSummary(),
  ]);
  if (onboarding.status.state !== "completed") redirect("/setup");

  const plan = summary.contentPlan;
  const todayTask = deriveTodayTask(plan);
  const weeklyProgress = getWeeklyPlanProgress(plan);
  const progressPercent = weeklyProgress.total
    ? Math.round((weeklyProgress.generated / weeklyProgress.total) * 100)
    : 0;

  return (
    <AppShell active="/">
      <PageHeader
        eyebrow="TODAY"
        title="今天的内容任务"
        description="先完成最重要的一步，再处理其他内容工作。"
      />

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-72 flex-col justify-between rounded-2xl border border-[#dfb967]/50 bg-[#f5ecd9] p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#856522]">{todayTask.eyebrow}</p>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {todayTask.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{todayTask.description}</p>
          </div>
          <Link className={`${primaryButtonClass} mt-8 w-full sm:w-fit`} href={todayTask.href}>
            {todayTask.actionLabel}
          </Link>
        </div>

        <div className="rounded-2xl bg-[#173e32] p-6 text-white sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#dfb967]">当前企业</p>
              <h2 className="mt-3 truncate text-2xl font-semibold">{summary.account?.accountName || "当前企业"}</h2>
            </div>
            <Link className="shrink-0 text-xs font-semibold text-white/70 hover:text-white" href="/brand">查看资料</Link>
          </div>
          <dl className="mt-7 grid gap-5 border-t border-white/10 pt-6">
            <ContextRow label="当前经营目标" value={plan?.operatingGoal || summary.account?.conversionGoal || "待生成内容计划"} />
            <ContextRow label="主渠道" value={plan ? channelLabels[plan.primaryChannel] : onboarding.status.primaryChannel ? channelLabels[onboarding.status.primaryChannel] : "待确认"} />
            <ContextRow label="计划状态" value={plan ? planStatusLabel(plan.status) : "尚未生成"} />
          </dl>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">本周计划进度</h2>
            <p className="mt-1 text-xs text-slate-500">生成内容计入推进，发布结果以人工记录为准。</p>
          </div>
          <Link className={secondaryButtonClass} href="/plans">查看完整计划</Link>
        </div>
        {plan ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <ProgressMetric label="本周选题" value={weeklyProgress.total} />
              <ProgressMetric label="已经开始" value={weeklyProgress.started} />
              <ProgressMetric label="已经生成" value={weeklyProgress.generated} />
              <ProgressMetric label="已经发布" value={weeklyProgress.published} />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="本周内容生成进度" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progressPercent}>
              <div className="h-full rounded-full bg-[#dfb967]" style={{ width: `${progressPercent}%` }} />
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-6">
            <p className="text-sm font-semibold text-slate-800">还没有内容计划</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">完成今天的首要任务后，这里会显示本周 7 个选题的真实进度。</p>
          </div>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">真实数据概览</h2>
          <p className="text-xs text-slate-400">只读取当前实例已经记录的数据</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCell><KnowledgeMaterialStat serverCount={summary.serverKnowledgeCount} /></MetricCell>
          <MetricCell detail={`已生成 ${formatNumber(summary.generatedContentCount)} 个渠道版本`} label="内容项目" value={summary.contentProjectCount} />
          <MetricCell detail="完成人工确认的项目" label="已审核" value={summary.approvedContentCount} />
          <MetricCell detail="已记录发布状态" label="已发布" value={summary.publishedContentCount} />
          <MetricCell detail="已记录发布数据" label="总阅读量" value={summary.totalViews} />
          <MetricCell detail={`总互动 ${formatNumber(summary.totalInteractions)}`} label="总点赞量" value={summary.totalLikes} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">其他入口</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">首要任务之外，需要时再进入这些功能。</p>
          <div className="mt-5 grid gap-3">
            {secondaryActions.map((action) => (
              <Link className="group flex items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-800/35 hover:bg-slate-50" href={action.href} key={action.href}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e9f0ec] text-sm font-semibold text-emerald-900">{action.mark}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-900">{action.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{action.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">最近内容</h2>
              <p className="mt-1 text-xs text-slate-500">最近创建或修改的内容项目</p>
            </div>
            <Link className={secondaryButtonClass} href="/articles">查看内容库</Link>
          </div>
          {summary.recentDrafts.length ? (
            <div className="divide-y divide-slate-100">
              {summary.recentDrafts.map((draft) => (
                <Link className="group grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6" href={`/drafts/${encodeURIComponent(draft.id)}`} key={draft.id}>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-900">{draft.topic}</h3>
                    <p className="mt-2 truncate text-xs text-slate-400">
                      {draft.generatedChannels.length ? draft.generatedChannels.map((channel) => channelLabels[channel]).join("、") : "尚未生成渠道内容"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold text-slate-600">{reviewStatusLabel(draft.reviewStatus)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(draft.updatedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#e9f0ec] text-base font-semibold text-emerald-900">稿</span>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">还没有内容项目</h3>
              <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">先完成上方首要任务，第一篇内容会自动出现在这里。</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-white/45">{label}</dt><dd className="mt-1.5 text-sm leading-6 text-white/85">{value}</dd></div>;
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="font-mono text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function MetricCell({ children, value, label, detail }: { children?: React.ReactNode; value?: number; label?: string; detail?: string }) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0 2xl:border-b-0 2xl:[&:nth-child(3n)]:border-r 2xl:last:border-r-0">
      {children ?? <><p className="font-mono text-3xl font-semibold tracking-tight text-slate-950">{formatNumber(value ?? 0)}</p><p className="mt-2 text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></>}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
