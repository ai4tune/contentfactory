"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import type { MarketItem } from "./types";
import type { Hotspot, HotKeyword } from "./providers/redfox-provider";
import type { TrackedAccountBundle } from "@/lib/db";
import { formatNumber, formatPlatformName } from "./utils";
import { rankingCategories } from "./categories";

const box = "space-y-4 rounded-2xl border border-slate-200 bg-white p-6";
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg bg-[#173e32] px-4 py-2 text-sm text-white disabled:opacity-50";
const socialPlatforms = [["xiaohongshu", "小红书"], ["douyin", "抖音"], ["wechat", "公众号"]];
const hotPlatforms = [["douyin", "抖音"], ["weibo", "微博"], ["bilibili", "B站"], ["kuaishou", "快手"], ["zhihu", "知乎"], ["toutiao", "头条"], ["baidu", "百度"]];
type CardProps = { ItemCard: ComponentType<{ item: MarketItem }> };
function shift(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }
function today() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
async function api<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || "请求失败");
  return data as T;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "请求失败，请重试"; }
function PlatformSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="flex items-center gap-2 text-sm">平台<select className={field} value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

export function HotPanel({ ItemCard }: CardProps) {
  const [platform, setPlatform] = useState("xiaohongshu");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<MarketItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  async function query() {
    setBusy(true); setError(""); setItems(null);
    try { const result = await api<{ items: MarketItem[]; note: string }>("/api/market/hot", { platform, date: date || shift(today(), -1), category }); setItems(result.items); setNote(result.note); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><section className={box}>
    <h2 className="text-lg font-semibold">平台作品榜</h2>
    <p className="text-sm text-slate-500">默认查询昨日。小红书为每日爆款榜，抖音为点赞榜，公众号为 5000+ 阅读热门文章；视频号请用主题搜索。每次查询最多调用一个接口，命中缓存不重复调用。</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void query(); }}>
      <PlatformSelect value={platform} onChange={value => { setPlatform(value); setCategory(""); setItems(null); }} options={socialPlatforms} />
      <label className="text-sm">榜单日期 <input type="date" className={field} value={date} onChange={event => { setDate(event.target.value); setItems(null); }} /></label>
      {platform === "wechat" ? <label className="text-sm">热门文章关键词 <input className={field} value={category} onChange={event => { setCategory(event.target.value); setItems(null); }} placeholder="例如：咖啡店（可留空）" maxLength={100} /></label> :
        <label className="text-sm">榜单分类 <select className={field} value={category} onChange={event => { setCategory(event.target.value); setItems(null); }}>
          <option value="">{platform === "xiaohongshu" ? "综合全部（默认）" : "全部（默认）"}</option>
          {rankingCategories[platform]?.filter(value => value !== "综合全部").map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>}
      <button className={button} disabled={busy}>{busy ? "查询中…" : "查看作品榜"}</button>
    </form>
    <p className="text-sm text-slate-500">榜单分类为平台固定选项，不能填写任意词。想找“咖啡店”“AI 企业落地”等具体内容？<Link className="ml-1 text-emerald-700 underline" href="/radar?tab=search">去主题搜索，输入关键词 →</Link></p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {items ? <><p className="text-xs text-slate-500">{note}</p>{items.length ? items.map(item => <ItemCard key={item.id} item={item} />) : <p>该日期和分类暂无榜单数据，可改查前一天。</p>}</> : null}
  </section><HotspotsPanel /><KeywordsPanel /></div>;
}

function KeywordsPanel() {
  const [date, setDate] = useState("");
  const [items, setItems] = useState<HotKeyword[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function query() {
    setBusy(true); setError(""); setItems(null);
    try { setItems((await api<{ items: HotKeyword[] }>("/api/market/hot-keywords", { date: date || today() })).items); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <section className={box}><h2 className="text-lg font-semibold">全网聚合热点 TOP10</h2><p className="text-sm text-slate-500">按数据源聚合的跨平台事件展示，默认今日。每次最多一个接口请求；点击事件搜索相关作品。</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void query(); }}>
      <label className="text-sm">日期 <input className={field} type="date" value={date} onChange={event => { setDate(event.target.value); setItems(null); }} /></label>
      <button className={button} disabled={busy}>{busy ? "查询中…" : "查看聚合热点"}</button>
    </form>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {items ? items.length ? items.map((item, index) => <div key={`${item.keyword}:${index}`} className="rounded-xl border border-slate-200 p-4">
      <Link className="font-semibold text-emerald-800" href={`/radar?tab=search&q=${encodeURIComponent(item.keyword)}`}>{index + 1}. {item.keyword}</Link>
      <ul className="mt-2 space-y-2 text-sm text-slate-500">{item.sources.map((source, index) => <li key={`${source.url}:${index}`}>{source.platform} · {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : source.title}</li>)}</ul>
    </div>) : <p className="text-sm text-slate-500">该日期暂无聚合热点。</p> : null}
  </section>;
}

function HotspotsPanel() {
  const [platform, setPlatform] = useState("douyin");
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Hotspot[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function query() {
    setBusy(true); setError(""); setItems(null);
    try { const start = date || today(); setItems((await api<{ items: Hotspot[] }>("/api/market/hotspots", { platform, keyword, startDate: start, endDate: shift(start, 1) })).items); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <section className={box}><h2 className="text-lg font-semibold">平台热搜</h2><p className="text-sm text-slate-500">小时级更新，默认今日。热度是平台榜单指标，不是阅读或点赞。点击热词继续搜索相关作品。</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void query(); }}>
      <PlatformSelect value={platform} onChange={value => { setPlatform(value); setItems(null); }} options={hotPlatforms} />
      <label className="text-sm">日期 <input type="date" value={date} className={field} onChange={event => { setDate(event.target.value); setItems(null); }} /></label>
      <input aria-label="热搜关键词" className={field} placeholder="可选关键词" maxLength={100} value={keyword} onChange={event => { setKeyword(event.target.value); setItems(null); }} />
      <button className={button} disabled={busy}>{busy ? "查询中…" : "查看热搜"}</button>
    </form>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {items ? <HotspotList items={items} /> : null}
  </section>;
}

function HotspotList({ items }: { items: Hotspot[] }) {
  if (!items.length) return <p className="text-sm text-slate-500">当前条件暂无热搜样本。</p>;
  return <ul className="divide-y divide-slate-100">{items.map((item, index) => <li key={`${item.id}:${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
    <Link className="min-w-0 flex-1 text-emerald-800" href={`/radar?tab=search&q=${encodeURIComponent(item.title)}`}>{item.rank ?? "—"}. {item.title}</Link>
    <span>热度 {item.heatLabel || "未知"}</span>
    {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-500">原始榜单 ↗</a> : null}
  </li>)}</ul>;
}

type TrendResult = { current: Hotspot[]; previous: Hotspot[]; currentAverage: number | null; previousAverage: number | null; growth: number | null; windows: { start: string; middle: string; end: string }; note: string };
export function TrendsPanel() {
  const [platform, setPlatform] = useState("douyin");
  const [keyword, setKeyword] = useState("");
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<TrendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function query() {
    setBusy(true); setError(""); setResult(null);
    try { setResult(await api<TrendResult>("/api/market/trends", { platform, keyword, days })); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <section className={box}><h2 className="text-lg font-semibold">热搜趋势对比</h2><p className="text-sm text-slate-500">对比截至昨日的两个等长完整周期，每次最多调用两个接口。支持热搜平台，不以作品发布时间冒充热度增长。</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void query(); }}>
      <PlatformSelect value={platform} onChange={value => { setPlatform(value); setResult(null); }} options={hotPlatforms} />
      <input required aria-label="趋势关键词" className={field} placeholder="例如 AI 编程" value={keyword} maxLength={100} onChange={event => { setKeyword(event.target.value); setResult(null); }} />
      <label className="text-sm">周期 <select className={field} value={days} onChange={event => { setDays(Number(event.target.value)); setResult(null); }}>{[3, 7, 14].map(value => <option value={value} key={value}>{value} 天</option>)}</select></label>
      <button className={button} disabled={busy || !keyword.trim()}>{busy ? "对比中…" : "对比趋势"}</button>
    </form>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {result ? <><p className="text-xs text-slate-500">{result.note}</p><div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-slate-50 p-4">上期平均热度<p>{formatNumber(result.previousAverage)}</p><small>{result.windows.start} 至 {result.windows.middle}（不含）· {result.previous.length} 条</small></div>
      <div className="rounded-xl bg-slate-50 p-4">本期平均热度<p>{formatNumber(result.currentAverage)}</p><small>{result.windows.middle} 至 {result.windows.end}（不含）· {result.current.length} 条</small></div>
      <div className="rounded-xl bg-emerald-50 p-4">样本变化<p>{result.growth === null ? "基期不足，不计算" : `${(result.growth * 100).toFixed(1)}%`}</p></div>
    </div><HotspotList items={result.current} /></> : null}
  </section>;
}

export function AccountsPanel({ ItemCard }: CardProps) {
  const [platform, setPlatform] = useState("xiaohongshu");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<TrackedAccountBundle[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<{ accounts: TrackedAccountBundle[] }>("/api/market/accounts", undefined, "GET").then(data => { if (active) setAccounts(data.accounts); }).catch(error => { if (active) setError(errorText(error)); }); return () => { active = false; }; }, []);
  async function update(id?: string) {
    setBusy(true); setError("");
    try { const result = await api<TrackedAccountBundle>(id ? `/api/market/accounts/${encodeURIComponent(id)}` : "/api/market/accounts", id ? {} : { platform, accountId: accountId.trim() }); setAccounts(current => [result, ...current.filter(row => row.account.id !== result.account.id)]); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("停止追踪该账号？已收藏的内容和选题不会删除。")) return;
    setBusy(true); setError("");
    try { await api(`/api/market/accounts/${encodeURIComponent(id)}`, undefined, "DELETE"); setAccounts(current => current.filter(row => row.account.id !== id)); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <section className={box}><h2 className="text-lg font-semibold">对标账号</h2><p className="text-sm text-slate-500">输入平台账号 ID（不是昵称或主页链接）。每次添加/刷新最多查询账号和近期 20 篇作品，不后台轮询；一小时内可能返回缓存。不会更换你的当前创作账号。公众号粉丝数不可用时显示未知。</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void update(); }}>
      <PlatformSelect value={platform} onChange={setPlatform} options={socialPlatforms} />
      <input required aria-label="对标账号 ID" className={field} value={accountId} onChange={event => setAccountId(event.target.value)} placeholder="小红书号 / 抖音号 / 公众号微信号" maxLength={200} />
      <button className={button} disabled={busy || !accountId.trim()}>{busy ? "处理中…" : "添加追踪"}</button>
    </form>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {!accounts.length ? <p className="text-sm text-slate-500">暂无已追踪账号。</p> : accounts.map(({ account, items }) => <div className="space-y-3 rounded-xl border border-slate-200 p-4" key={account.id}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{account.name} · {formatPlatformName(account.platform)}</h3><p className="text-sm text-slate-500">粉丝 {formatNumber(account.followers)} · 作品 {formatNumber(account.worksCount)}</p><p className="text-xs text-slate-400">最近查询 {account.updatedAt}</p></div>
        <div className="flex gap-2"><button className={field} disabled={busy} onClick={() => void update(account.id)}>刷新账号</button><button className={field} disabled={busy} onClick={() => void remove(account.id)}>停止追踪</button></div></div>
      <details><summary className="cursor-pointer text-sm text-emerald-800">查看近期作品（{items.length} 篇）</summary><div className="mt-3 space-y-3">{items.length ? items.map(item => <ItemCard item={item} key={item.id} />) : <p>数据源未返回近期作品。</p>}</div></details>
    </div>)}
  </section>;
}
