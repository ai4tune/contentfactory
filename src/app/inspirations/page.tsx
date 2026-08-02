import Link from "next/link";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";
import { formatInspirationMetrics } from "@/modules/inspirations/normalization";
import { listInspirationRecords } from "@/modules/inspirations/service";

export const dynamic = "force-dynamic";

export default async function InspirationsPage() {
  const inspirations = await listInspirationRecords();

  return (
    <AppShell active="/inspirations">
      <PageHeader
        eyebrow="VIRAL CONTENT LIBRARY"
        title="爆款库"
        description="这里保存的是外部高表现内容，以及 AI 总结出的可迁移方法。学习结构，不照抄原文。"
        actions={<Link className={primaryButtonClass} href="/inspirations/new">＋ 录入爆款</Link>}
      />

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">已拆解内容</h2>
            <p className="mt-1 text-xs text-slate-500">点击文章查看原文与核心学习点</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{inspirations.length} 篇</span>
        </div>

        {inspirations.length ? (
          <div className="divide-y divide-slate-100">
            {inspirations.map((item) => {
              const metrics = formatInspirationMetrics(item.metrics);
              return <Link key={item.id} href={`/inspirations/${item.id}`} className="group grid gap-5 px-5 py-6 transition hover:bg-[#fafaf7] sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px_32px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{item.source.platform}</span>
                    {item.discovery.sourceKeyword ? <span className="text-slate-400">关键词：{item.discovery.sourceKeyword}</span> : null}
                    <span className="text-slate-400">{formatDate(item.updatedAt)}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 group-hover:text-emerald-800">{item.content.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.analysis.summary}</p>
                  {metrics ? <p className="mt-3 text-xs font-medium text-slate-400">互动数据 · {metrics}</p> : null}
                </div>

                <div className="rounded-2xl bg-[#f5f6f3] p-4">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-700">可以学习什么</p>
                  <ul className="mt-3 space-y-2">
                    {item.analysis.reusablePatterns.slice(0, 2).map((pattern) => (
                      <li key={pattern} className="line-clamp-2 text-xs leading-5 text-slate-600">• {pattern}</li>
                    ))}
                  </ul>
                </div>
                <span className="hidden text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700 lg:block">→</span>
              </Link>;
            })}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">◇</span>
            <h3 className="mt-5 text-base font-semibold">还没有爆款样本</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">从小红书、公众号或视频号找到一篇高表现内容，录入后 AI 会自动拆解并保存。</p>
            <Link className={`${primaryButtonClass} mt-5`} href="/inspirations/new">录入第一篇爆款</Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
