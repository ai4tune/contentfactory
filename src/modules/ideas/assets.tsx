"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketHistory } from "@/modules/market/history";

type SavedInspiration = { id: string; title: string; summary: string; statusLabel: string };
export function IdeasAssets({ kind }: { kind: "history" | "viral" }) {
  const [history, setHistory] = useState<MarketHistory[]>([]);
  const [saved, setSaved] = useState<SavedInspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(kind === "viral" ? "/api/inspirations" : "/api/market/history").then(async response => {
      if (!response.ok) throw new Error("已保存内容读取失败，请刷新重试");
      const data = await response.json();
      if (active) { setHistory(data.records || []); setSaved(data.inspirations || []); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);
  if (loading) return <p role="status">读取已保存内容…</p>;
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (kind === "viral") return <section className="space-y-3">
    <Link href="/inspirations" className="text-emerald-700 underline">完整爆款库 · {saved.length} 篇 →</Link>
    {!saved.length && <p>还没有收藏。去市场搜索选择感兴趣的内容，或手动录入。</p>}
    {saved.map(item => <Link key={item.id} href={`/inspirations/${item.id}`} className="block rounded-xl border bg-white p-4"><span className="text-xs text-emerald-700">{item.statusLabel}</span><h3 className="mt-2 font-semibold">{item.title}</h3><p className="mt-2 text-sm text-slate-500">{item.summary || "尚未拆解，点击补充正文并分析"}</p></Link>)}
  </section>;
  return <section className="space-y-5">
    <div><h2 className="font-semibold">最近搜索</h2><p className="text-xs text-slate-500">读取本地记录，不请求 RedFox；搜索结果不等于热门话题。</p>
      {history.filter(row => row.kind === "search").slice(0, 10).map(row => <Link key={row.id} href={`/radar?tab=search&history=${encodeURIComponent(row.id)}`} className="mt-2 block rounded-lg border bg-white p-3">{row.query.keyword} · 第 {row.query.page} 页 · {row.items.length} 条</Link>)}
      {!history.some(row => row.kind === "search") && <p className="mt-3 text-sm">暂无查询记录。历史版本的数据仍在数据库，本次升级后的查询会记录完整快照。</p>}
    </div>
    <div><h2 className="font-semibold">最近获取的热门作品</h2><p className="text-xs text-slate-500">仅显示你主动查询过的榜单，不自动收费更新。</p>
      {history.filter(row => row.kind === "hot").slice(0, 3).map(row => <div key={row.id} className="mt-3 rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{row.query.date} · {row.query.category || "全部"}</p>{row.items.slice(0, 5).map(item => <p key={item.id} className="mt-2">{item.title}</p>)}</div>)}
      {!history.some(row => row.kind === "hot") && <p className="mt-3 text-sm">尚未获取榜单。<Link href="/radar?tab=hot" className="text-emerald-700 underline">去查看热榜</Link></p>}
    </div>
  </section>;
}
