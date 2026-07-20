import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, PageHeader, secondaryButtonClass } from "@/components/app-shell";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InspirationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await readStore();
  const item = store.inspirations.find((record) => record.id === id);

  if (!item) notFound();

  return (
    <AppShell active="/inspirations">
      <PageHeader
        eyebrow={`${item.input.platform} · 爆款拆解`}
        title={item.input.title}
        description={item.input.metrics || "未录入原始互动数据"}
        actions={<Link className={secondaryButtonClass} href="/inspirations">返回爆款库</Link>}
      />

      <div className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold">原始内容</h2>
            {item.input.sourceUrl ? <a className="text-xs font-semibold text-emerald-700 hover:underline" href={item.input.sourceUrl} target="_blank" rel="noreferrer">查看原文 ↗</a> : null}
          </div>
          <div className="mt-5 rounded-2xl bg-[#f7f7f4] p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.input.content}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info label="来源关键词" value={item.input.sourceKeyword || "未记录"} />
            <Info label="采集时间" value={formatDate(item.createdAt)} />
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-3xl bg-[#173e32] p-6 text-white shadow-sm">
            <p className="text-xs font-semibold tracking-[0.15em] text-[#dfb967]">AI 核心结论</p>
            <p className="mt-4 text-base leading-8 text-white/85">{item.result.summary}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <DarkInfo label="目标人群" value={item.result.targetAudience} />
              <DarkInfo label="核心痛点" value={item.result.painPoint} />
              <DarkInfo label="开头钩子" value={item.result.hook} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <DetailList title="最值得学习的核心点" items={item.result.reusablePatterns} accent />
            <DetailList title="文章结构" items={item.result.structure} numbered />
            <DetailList title="适合当前账号的改写方向" items={item.result.adaptationIdeas.length ? item.result.adaptationIdeas : item.result.topicCandidates} />
            {item.result.riskNotes.length ? <DetailList title="风险提醒" items={item.result.riskNotes} /> : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>; }
function DarkInfo({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/8 p-4"><p className="text-xs text-white/45">{label}</p><p className="mt-2 line-clamp-4 text-xs leading-5 text-white/75">{value}</p></div>; }
function DetailList({ title, items, accent, numbered }: { title: string; items: string[]; accent?: boolean; numbered?: boolean }) {
  return <div className="border-b border-slate-100 py-5 first:pt-0 last:border-0 last:pb-0"><h3 className="text-sm font-semibold">{title}</h3><ul className="mt-3 space-y-3">{items.map((item, index) => <li key={`${title}-${index}`} className={`flex gap-3 rounded-xl p-3 text-sm leading-6 ${accent ? "bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-600"}`}><span className="font-semibold text-emerald-700">{numbered ? `${index + 1}.` : "•"}</span>{item}</li>)}</ul></div>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

