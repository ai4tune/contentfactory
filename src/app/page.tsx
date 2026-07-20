import Link from "next/link";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const flow = [
  { label: "账号定位", href: "/positioning", key: "profile" },
  { label: "学习爆款", href: "/inspirations", key: "inspirations" },
  { label: "沉淀素材", href: "/materials", key: "materials" },
  { label: "生成内容", href: "/workbench", key: "articles" },
  { label: "发布复盘", href: "/articles", key: "published" },
] as const;

export default async function Dashboard() {
  const store = await readStore();
  const profile = store.accountProfiles.at(-1) ?? null;
  const published = store.articles.filter((article) => article.publication);
  const totalMetrics = published.reduce((sum, article) => {
    const metrics = article.publication?.metrics;
    return { views: sum.views + (metrics?.views ?? 0), interactions: sum.interactions + (metrics?.likes ?? 0) + (metrics?.saves ?? 0) + (metrics?.comments ?? 0) + (metrics?.replies ?? 0) };
  }, { views: 0, interactions: 0 });
  const progress = { profile: Boolean(profile), inspirations: store.inspirations.length > 0, materials: store.materials.length > 0, articles: store.articles.length > 0, published: published.length > 0 };
  const nextStep = flow.find((step) => !progress[step.key]) ?? flow[4];
  const recentInspirations = [...store.inspirations].reverse().slice(0, 3);
  const recentArticles = [...store.articles].reverse().slice(0, 3);

  return (
    <AppShell active="/">
      <PageHeader
        eyebrow="CONTENT FACTORY"
        title={profile ? `${profile.input.accountName || "当前账号"}的内容工作台` : "先建立一个清晰的账号方向"}
        description={profile ? "从一个稳定定位出发，持续学习爆款、调用企业素材、生产内容并用真实数据校准。" : "完成一次账号定位，后面的选题、拆解和写作都会自动继承。"}
        actions={<Link className={primaryButtonClass} href={nextStep.href}>{nextStep.label === "发布复盘" ? "更新发布数据" : `继续：${nextStep.label}`} →</Link>}
      />

      <section className="mt-7 overflow-hidden rounded-3xl bg-[#173e32] text-white shadow-sm">
        <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[1fr_420px] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#dfb967] px-3 py-1 text-xs font-semibold text-[#173e32]">{profile ? "账号已就绪" : "尚未定位"}</span>{profile ? <span className="text-xs text-white/45">单账号模式</span> : null}</div>
            <h2 className="mt-6 text-xl font-semibold sm:text-2xl">{profile?.result.accountPosition || "账号定位会成为整个内容流程的共同上下文"}</h2>
            <div className="mt-6 flex flex-wrap gap-2">{profile?.result.keywordSeeds.slice(0, 6).map((keyword) => <span key={keyword} className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/65">{keyword}</span>)}</div>
          </div>
          <div className="rounded-2xl bg-white/8 p-5">
            <p className="text-xs font-semibold tracking-[0.15em] text-[#dfb967]">现在最值得做</p>
            <h3 className="mt-3 text-lg font-semibold">{nextStep.label}</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">{nextStepDescription(nextStep.key)}</p>
            <Link className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-[#173e32]" href={nextStep.href}>开始这一步 →</Link>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">内容生产主流程</h2><p className="mt-1 text-xs text-slate-500">每一步都积累成下一步的输入</p></div><span className="text-xs font-semibold text-emerald-700">{Object.values(progress).filter(Boolean).length} / 5</span></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">{flow.map((step, index) => { const done = progress[step.key]; const current = step.key === nextStep.key; return <Link key={step.key} href={step.href} className={`relative rounded-2xl border p-4 transition ${current ? "border-emerald-700 bg-emerald-50" : done ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}><div className="flex items-center justify-between"><span className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-700 text-white" : current ? "bg-[#dfb967] text-[#173e32]" : "bg-slate-200 text-slate-500"}`}>{done ? "✓" : index + 1}</span>{current ? <span className="text-[10px] font-semibold text-emerald-700">下一步</span> : null}</div><p className={`mt-4 text-sm font-semibold ${done || current ? "text-slate-900" : "text-slate-400"}`}>{step.label}</p></Link>; })}</div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AssetCard label="爆款库" value={store.inspirations.length} unit="篇" note="已完成结构拆解" href="/inspirations" icon="◇" />
        <AssetCard label="素材库" value={store.materials.length} unit="份" note="可用于内容生成" href="/materials" icon="▤" />
        <AssetCard label="内容库" value={store.articles.length} unit="篇" note={`${published.length} 篇已发布`} href="/articles" icon="✎" />
        <AssetCard label="累计阅读" value={totalMetrics.views} unit="" note={`${formatNumber(totalMetrics.interactions)} 次互动`} href="/articles" icon="◉" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">最近内容</h2><p className="mt-1 text-xs text-slate-500">草稿与发布表现</p></div><Link className="text-xs font-semibold text-emerald-700" href="/articles">查看内容库 →</Link></div>
          {recentArticles.length ? <div className="mt-5 divide-y divide-slate-100">{recentArticles.map((article) => <article key={article.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><h3 className="text-sm font-semibold">{article.input.topic}</h3><p className="mt-1 text-xs text-slate-400">{article.input.platform || "未指定平台"} · {formatDate(article.createdAt)}</p></div><div className="flex gap-5 text-right"><SmallMetric label="阅读" value={article.publication?.metrics.views} /><SmallMetric label="互动" value={article.publication ? article.publication.metrics.likes + article.publication.metrics.saves + article.publication.metrics.comments + article.publication.metrics.replies : undefined} /></div></article>)}</div> : <EmptyLine text="还没有生成内容。完成素材连接后就可以开始写第一篇。" href="/workbench" action="去写一篇" />}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">最近学习的爆款</h2><p className="mt-1 text-xs text-slate-500">用它们校准自己的内容结构</p></div><Link className="text-xs font-semibold text-emerald-700" href="/inspirations">查看爆款库 →</Link></div>
          {recentInspirations.length ? <div className="mt-5 space-y-3">{recentInspirations.map((item) => <Link key={item.id} href={`/inspirations/${item.id}`} className="block rounded-2xl bg-[#f6f7f4] p-4 transition hover:bg-emerald-50"><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700">{item.input.platform}</span><span className="text-[10px] text-slate-400">{item.input.sourceKeyword}</span></div><h3 className="mt-2 line-clamp-1 text-sm font-semibold">{item.input.title}</h3><p className="mt-2 line-clamp-1 text-xs text-slate-500">{item.result.reusablePatterns[0]}</p></Link>)}</div> : <EmptyLine text="录入一篇行业爆款，系统会拆解它为什么有效。" href="/inspirations/new" action="录入爆款" />}
        </section>
      </div>

      <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-[#f0e4c8] p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.14em] text-amber-900/60">QUICK START</p><h2 className="mt-2 text-lg font-semibold text-[#173e32]">今天就产出一篇能发布的内容</h2><p className="mt-1 text-sm text-amber-950/60">从选题开始，选择企业素材，生成后再人工审核。</p></div><div className="flex flex-wrap gap-2"><Link className={secondaryButtonClass} href="/topics">先找选题</Link><Link className={primaryButtonClass} href="/workbench">直接写一篇</Link></div></section>
    </AppShell>
  );
}

function AssetCard({ label, value, unit, note, href, icon }: { label: string; value: number; unit: string; note: string; href: string; icon: string }) { return <Link href={href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span></div><p className="mt-5 text-3xl font-semibold tracking-tight">{formatNumber(value)}<span className="ml-1 text-sm font-medium text-slate-400">{unit}</span></p><p className="mt-2 text-xs text-slate-400">{note}</p></Link>; }
function SmallMetric({ label, value }: { label: string; value?: number }) { return <div><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 font-mono text-sm font-semibold">{value === undefined ? "—" : formatNumber(value)}</p></div>; }
function EmptyLine({ text, href, action }: { text: string; href: string; action: string }) { return <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center"><p className="text-sm leading-6 text-slate-500">{text}</p><Link className="mt-3 inline-block text-xs font-semibold text-emerald-700" href={href}>{action} →</Link></div>; }
function nextStepDescription(key: (typeof flow)[number]["key"]) { return { profile: "完成一次定位，让后续所有 AI 操作有共同方向。", inspirations: "找一篇行业高表现内容，拆出可以学习的结构。", materials: "连接飞书或上传文件，为内容提供真实的企业事实。", articles: "基于定位、爆款方法和企业素材生成第一篇内容。", published: "记录真实阅读与互动数据，找出下一轮应该强化的方向。" }[key]; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatNumber(value: number) { return new Intl.NumberFormat("zh-CN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value); }

