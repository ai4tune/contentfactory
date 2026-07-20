"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { ArticleRecord, PublicationMetrics } from "@/lib/store";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { fetch("/api/articles", { cache: "no-store" }).then((response) => response.json()).then((payload: { articles?: ArticleRecord[] }) => setArticles(payload.articles ?? [])).finally(() => setLoading(false)); }, []);

  return (
    <AppShell active="/articles">
      <PageHeader eyebrow="CONTENT LIBRARY" title="内容库" description="草稿、已发布内容和平台表现都在一个列表中。发布后补充数据，系统才能知道什么内容真正有效。" actions={<Link className={primaryButtonClass} href="/workbench">＋ 写一篇内容</Link>} />
      <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(280px,1fr)_90px_repeat(5,72px)_104px] gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3 text-[11px] font-semibold text-slate-400 xl:grid"><span>内容</span><span>状态</span><span>阅读</span><span>点赞</span><span>收藏</span><span>评论</span><span>回复</span><span>操作</span></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-400">正在读取内容…</div> : articles.length ? <div className="divide-y divide-slate-100">{articles.map((article) => <ArticleRow key={article.id} article={article} editing={editingId === article.id} onEdit={() => setEditingId(editingId === article.id ? null : article.id)} onSaved={(updated) => { setArticles((items) => items.map((item) => item.id === updated.id ? updated : item)); setEditingId(null); }} />)}</div> : <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">✎</span><h3 className="mt-5 text-base font-semibold">还没有内容</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">从素材库选择资料，生成第一篇草稿。发布后再回来记录阅读和互动数据。</p><Link className={`${primaryButtonClass} mt-5`} href="/workbench">开始写第一篇</Link></div>}
      </section>
    </AppShell>
  );
}

function ArticleRow({ article, editing, onEdit, onSaved }: { article: ArticleRecord; editing: boolean; onEdit: () => void; onSaved: (article: ArticleRecord) => void }) {
  const [metrics, setMetrics] = useState<PublicationMetrics>(article.publication?.metrics ?? { views: 0, likes: 0, saves: 0, comments: 0, replies: 0 });
  const [url, setUrl] = useState(article.publication?.url ?? ""); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); const response = await fetch(`/api/articles/${article.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, publishedAt: article.publication?.publishedAt ?? new Date().toISOString(), metrics }) }); const payload = (await response.json()) as { article?: ArticleRecord }; if (payload.article) onSaved(payload.article); setBusy(false); }
  return <div><article className="grid gap-4 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(280px,1fr)_90px_repeat(5,72px)_104px] xl:items-center xl:gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{article.input.topic}</h3><p className="mt-1 text-xs text-slate-400">{article.input.platform || "未指定平台"} · {formatDate(article.createdAt)}</p><p className="mt-2 line-clamp-1 text-xs text-slate-500">{article.result.draft}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${article.publication ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{article.publication ? "已发布" : "草稿"}</span>{(["views", "likes", "saves", "comments", "replies"] as const).map((key) => <Metric key={key} label={{views:"阅读",likes:"点赞",saves:"收藏",comments:"评论",replies:"回复"}[key]} value={article.publication?.metrics[key]} />)}<button className={secondaryButtonClass} onClick={onEdit}>{article.publication ? "更新数据" : "记录发布"}</button></article>{editing ? <div className="border-t border-slate-100 bg-[#fafaf7] px-5 py-5 sm:px-6"><div className="grid gap-3 md:grid-cols-[1.5fr_repeat(5,0.55fr)_auto]"><input className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="发布链接" />{(["views", "likes", "saves", "comments", "replies"] as const).map((key) => <input key={key} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm" type="number" min="0" value={metrics[key]} onChange={(event) => setMetrics({ ...metrics, [key]: Number(event.target.value) })} placeholder={key} />)}<button className={primaryButtonClass} onClick={save} disabled={busy}>{busy ? "保存中" : "保存"}</button></div></div> : null}</div>;
}
function Metric({ label, value }: { label: string; value?: number }) { return <div><p className="text-[10px] text-slate-400 xl:hidden">{label}</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">{value === undefined ? "—" : formatNumber(value)}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatNumber(value: number) { return new Intl.NumberFormat("zh-CN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value); }

