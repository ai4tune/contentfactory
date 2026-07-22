import Link from "next/link";
import {
  AppShell,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/app-shell";
import { channelLabels } from "@/modules/content/types";
import { KnowledgeMaterialStat } from "@/modules/dashboard/components/knowledge-material-stat";
import { getDashboardSummary } from "@/modules/dashboard/server/summary";

export const dynamic = "force-dynamic";

const quickActions = [
  { title: "写一篇内容", description: "从选题和知识开始生成四种渠道内容", href: "/create", mark: "写", primary: true },
  { title: "查看当前账号", description: "检查账号定位和长期内容方向", href: "/positioning", mark: "账" },
  { title: "管理知识库", description: "连接本地文件夹或飞书资料", href: "/knowledge", mark: "知" },
  { title: "继续编辑草稿", description: "找回历史项目并完成人工审核", href: "/drafts", mark: "稿" },
  { title: "更新发布数据", description: "记录阅读、点赞、收藏和评论", href: "/articles", mark: "数" },
];

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const hasConfirmedAccount = summary.account?.status === "confirmed";

  return (
    <AppShell active="/">
      <PageHeader
        title="内容经营总览"
        description="先看清当前账号、知识与内容进度，再决定今天从哪里继续。"
        actions={
          <Link className={primaryButtonClass} href="/create">
            开始创作
          </Link>
        }
      />

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl bg-[#173e32] p-6 text-white sm:p-7">
          {hasConfirmedAccount ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#dfb967]">当前账号</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {summary.account?.accountName || "当前账号"}
                  </h2>
                  <p className="mt-2 text-xs text-white/55">
                    {summary.account?.platforms.length
                      ? summary.account.platforms.join("、")
                      : "暂未记录运营平台"}
                  </p>
                </div>
                <Link
                  className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
                  href="/positioning"
                >
                  查看定位
                </Link>
              </div>
              <div className="mt-7 border-t border-white/10 pt-5">
                <p className="text-xs text-white/45">账号定位</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                  {summary.account?.accountPosition || "定位已确认，暂未生成文字说明。"}
                </p>
              </div>
              {summary.account?.contentPillars.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {summary.account.contentPillars.slice(0, 4).map((pillar) => (
                    <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white/75" key={pillar}>
                      {pillar}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-48 flex-col items-start justify-center">
              <p className="text-xs font-semibold text-[#dfb967]">当前账号</p>
              <h2 className="mt-3 text-2xl font-semibold">还没有确认账号定位</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                先通过浏览器插件采集账号内容并确认定位，后续选题和写作都会以此为基础。
              </p>
              <Link className="mt-5 text-sm font-semibold text-[#dfb967]" href="/positioning">
                建立账号定位
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#dfb967]/45 bg-[#f5ecd9] p-6 sm:p-7">
          <div>
            <p className="text-xs font-semibold text-[#856522]">今天可以继续</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              从一个明确选题开始
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              选择知识资料，生成公众号、小红书、朋友圈和短视频内容。
            </p>
          </div>
          <Link className={`${primaryButtonClass} mt-7 w-full`} href="/create">
            写一篇内容
          </Link>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">数据概览</h2>
          <p className="text-xs text-slate-400">互动数据来自已记录的发布内容</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCell>
            <KnowledgeMaterialStat serverCount={summary.serverKnowledgeCount} />
          </MetricCell>
          <MetricCell
            detail={`已生成 ${formatNumber(summary.generatedContentCount)} 个渠道版本`}
            label="内容项目"
            value={summary.contentProjectCount}
          />
          <MetricCell
            detail="完成人工确认的项目"
            label="已审核"
            value={summary.approvedContentCount}
          />
          <MetricCell detail="已记录发布状态" label="已发布" value={summary.publishedContentCount} />
          <MetricCell detail="已记录发布数据" label="总阅读量" value={summary.totalViews} />
          <MetricCell detail={`总互动 ${formatNumber(summary.totalInteractions)}`} label="总点赞量" value={summary.totalLikes} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">快捷入口</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">直接进入今天要完成的操作。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                className={`group flex min-h-24 items-start gap-3 rounded-2xl border p-4 transition active:translate-y-px ${
                  action.primary
                    ? "border-emerald-900/15 bg-[#e9f0ec] hover:border-emerald-800/35"
                    : "border-slate-200 hover:border-emerald-800/35 hover:bg-slate-50"
                }`}
                href={action.href}
                key={action.href}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-emerald-900 shadow-sm">
                  {action.mark}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-900">
                    {action.title}
                  </span>
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
            <Link className={secondaryButtonClass} href="/drafts">
              查看全部
            </Link>
          </div>
          {summary.recentDrafts.length ? (
            <div className="divide-y divide-slate-100">
              {summary.recentDrafts.map((draft) => (
                <Link
                  className="group grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  href={`/drafts/${encodeURIComponent(draft.id)}`}
                  key={draft.id}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-900">
                      {draft.topic}
                    </h3>
                    <p className="mt-2 truncate text-xs text-slate-400">
                      {draft.generatedChannels.length
                        ? draft.generatedChannels.map((channel) => channelLabels[channel]).join("、")
                        : "尚未生成渠道内容"}
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
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#e9f0ec] text-base font-semibold text-emerald-900">稿</span>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">还没有内容项目</h3>
              <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                选择一个选题和知识资料，生成第一批渠道内容。
              </p>
              <Link className={`${primaryButtonClass} mt-5`} href="/create">
                开始第一篇
              </Link>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function MetricCell({
  children,
  value,
  label,
  detail,
}: {
  children?: React.ReactNode;
  value?: number;
  label?: string;
  detail?: string;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0 2xl:border-b-0 2xl:[&:nth-child(3n)]:border-r 2xl:last:border-r-0">
      {children ?? (
        <>
          <p className="font-mono text-3xl font-semibold tracking-tight text-slate-950">{formatNumber(value ?? 0)}</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function reviewStatusLabel(status: "draft" | "editing" | "approved") {
  if (status === "approved") return "已确认";
  if (status === "editing") return "编辑中";
  return "待人工审核";
}
