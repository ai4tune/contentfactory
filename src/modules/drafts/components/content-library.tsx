"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, contentChannels, type ContentChannel } from "@/modules/content/types";
import type {
  ContentLibraryItem,
  ContentPublication,
  PublicationMetrics,
} from "../types";

const metricKeys = ["views", "likes", "saves", "comments", "replies"] as const;
const metricLabels: Record<(typeof metricKeys)[number], string> = {
  views: "阅读",
  likes: "点赞",
  saves: "收藏",
  comments: "评论",
  replies: "回复",
};
const emptyMetrics: PublicationMetrics = {
  views: 0,
  likes: 0,
  saves: 0,
  comments: 0,
  replies: 0,
};

export function ContentLibrary({ initialItems }: { initialItems: ContentLibraryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ContentChannel | "all">("all");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return items.filter((item) => {
      const matchesQuery = !normalizedQuery || item.topic.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
      const matchesChannel = channel === "all" || item.channel === channel;
      const matchesStatus = status === "all"
        || (status === "published" ? Boolean(item.publication) : !item.publication);
      return matchesQuery && matchesChannel && matchesStatus;
    });
  }, [channel, items, query, status]);
  const publishedItems = items.filter((item) => item.publication);
  const totalViews = publishedItems.reduce(
    (total, item) => total + (item.publication?.metrics.views ?? 0),
    0,
  );
  const totalInteractions = publishedItems.reduce(
    (total, item) => total
      + (item.publication?.metrics.likes ?? 0)
      + (item.publication?.metrics.saves ?? 0)
      + (item.publication?.metrics.comments ?? 0)
      + (item.publication?.metrics.replies ?? 0),
    0,
  );

  function savePublication(itemId: string, publication: ContentPublication) {
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, publication, updatedAt: publication.updatedAt }
      : item));
    setEditingId(null);
  }

  return (
    <>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="全部内容" value={items.length} />
        <SummaryCard label="待发布" value={items.length - publishedItems.length} />
        <SummaryCard label="已发布" value={publishedItems.length} />
        <SummaryCard label="总阅读 / 互动" value={`${formatNumber(totalViews)} / ${formatNumber(totalInteractions)}`} />
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(220px,1fr)_180px_150px] sm:p-5">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-800"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索选题"
            value={query}
          />
          <select className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm" onChange={(event) => setChannel(event.target.value as ContentChannel | "all")} value={channel}>
            <option value="all">全部渠道</option>
            {contentChannels.map((item) => <option key={item} value={item}>{channelLabels[item]}</option>)}
          </select>
          <select className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
            <option value="all">全部状态</option>
            <option value="draft">待发布</option>
            <option value="published">已发布</option>
          </select>
        </div>

        <div className="hidden grid-cols-[minmax(260px,1fr)_80px_repeat(5,64px)_96px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-semibold text-slate-400 xl:grid">
          <span>内容</span><span>状态</span>
          {metricKeys.map((key) => <span key={key}>{metricLabels[key]}</span>)}
          <span>操作</span>
        </div>

        {visibleItems.length ? (
          <div className="divide-y divide-slate-100">
            {visibleItems.map((item) => (
              <PublicationRow
                editing={editingId === item.id}
                item={item}
                key={item.id}
                onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                onSaved={(publication) => savePublication(item.id, publication)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-semibold text-emerald-800">文</span>
            <h2 className="mt-5 text-base font-semibold text-slate-900">{items.length ? "没有符合筛选条件的内容" : "还没有生成内容"}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{items.length ? "调整搜索、渠道或发布状态后再查看。" : "完成一次渠道内容生成后，它会自动进入这里。"}</p>
            {!items.length ? <Link className={`${primaryButtonClass} mt-5`} href="/create">开始写第一篇</Link> : null}
          </div>
        )}
      </section>
    </>
  );
}

function PublicationRow({
  editing,
  item,
  onEdit,
  onSaved,
}: {
  editing: boolean;
  item: ContentLibraryItem;
  onEdit: () => void;
  onSaved: (publication: ContentPublication) => void;
}) {
  const [metrics, setMetrics] = useState<PublicationMetrics>(item.publication?.metrics ?? emptyMetrics);
  const [url, setUrl] = useState(item.publication?.url ?? "");
  const [publishedAt, setPublishedAt] = useState(toLocalDateTime(item.publication?.publishedAt ?? item.updatedAt));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/content-drafts/${encodeURIComponent(item.draftId)}/publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: item.channel,
          url,
          publishedAt: new Date(publishedAt).toISOString(),
          metrics,
        }),
      });
      const payload = (await response.json()) as { publication?: ContentPublication; error?: string };
      if (!response.ok || !payload.publication) throw new Error(payload.error ?? "发布数据保存失败");
      onSaved(payload.publication);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布数据保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-content-id={item.id}>
      <article className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(260px,1fr)_80px_repeat(5,64px)_96px] xl:items-center xl:gap-3">
        <div className="min-w-0">
          <Link className="truncate text-sm font-semibold text-slate-900 hover:text-emerald-900" href={`/drafts/${encodeURIComponent(item.draftId)}`}>{item.topic}</Link>
          <p className="mt-1 text-xs text-slate-400">{channelLabels[item.channel]} · {formatDate(item.updatedAt)}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt || "暂无正文摘要"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`w-fit rounded-lg px-2.5 py-1 text-[11px] font-semibold ${item.publication ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{item.publication ? "已发布" : "待发布"}</span>
          {item.publication?.url ? <a className="text-[11px] font-semibold text-emerald-800 xl:hidden" href={item.publication.url} rel="noreferrer" target="_blank">查看链接</a> : null}
        </div>
        {metricKeys.map((key) => <Metric key={key} label={metricLabels[key]} value={item.publication?.metrics[key]} />)}
        <button className={secondaryButtonClass} onClick={onEdit} type="button">{editing ? "收起" : item.publication ? "更新数据" : "记录发布"}</button>
      </article>

      {editing ? (
        <div className="border-t border-slate-100 bg-[#fafaf7] px-5 py-5">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px]">
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">发布链接<input className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" onChange={(event) => setUrl(event.target.value)} placeholder="https://" value={url} /></label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">发布时间<input className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" onChange={(event) => setPublishedAt(event.target.value)} type="datetime-local" value={publishedAt} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {metricKeys.map((key) => (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-600" key={key}>{metricLabels[key]}<input className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" min="0" onChange={(event) => setMetrics((current) => ({ ...current, [key]: Number(event.target.value) }))} type="number" value={metrics[key]} /></label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">未发布的数据保持为空，不会生成模拟指标。</p>
              <button className={primaryButtonClass} disabled={busy || !publishedAt} onClick={save} type="button">{busy ? "保存中" : "保存发布记录"}</button>
            </div>
            {message ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-mono text-2xl font-semibold text-slate-950">{typeof value === "number" ? formatNumber(value) : value}</p><p className="mt-2 text-xs font-semibold text-slate-500">{label}</p></div>;
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <div><p className="text-[10px] text-slate-400 xl:hidden">{label}</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">{value === undefined ? "—" : formatNumber(value)}</p></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
