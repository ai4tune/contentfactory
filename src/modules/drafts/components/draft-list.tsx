"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { channelLabels, contentChannels, type ContentChannel } from "@/modules/content/types";
import type { DraftListItem, DraftReviewStatus } from "../types";

const reviewLabels: Record<DraftReviewStatus, string> = {
  draft: "待人工审核",
  editing: "编辑中",
  approved: "已确认",
};

export function DraftList({ initialDrafts }: { initialDrafts: DraftListItem[] }) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ContentChannel | "all">("all");
  const [reviewStatus, setReviewStatus] = useState<DraftReviewStatus | "all">("all");
  const drafts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return initialDrafts.filter((draft) => {
      const matchesQuery = !normalizedQuery || draft.topic.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
      const matchesChannel = channel === "all" || draft.generatedChannels.includes(channel);
      const matchesReview = reviewStatus === "all" || draft.reviewStatus === reviewStatus;
      return matchesQuery && matchesChannel && matchesReview;
    });
  }, [channel, initialDrafts, query, reviewStatus]);

  if (!initialDrafts.length) return <EmptyDrafts />;

  return (
    <section className="mt-7">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          <span>搜索选题</span>
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-emerald-800"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入选题关键词"
            value={query}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          <span>生成渠道</span>
          <select
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-800"
            onChange={(event) => setChannel(event.target.value as ContentChannel | "all")}
            value={channel}
          >
            <option value="all">全部渠道</option>
            {contentChannels.map((item) => <option key={item} value={item}>{channelLabels[item]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          <span>审核状态</span>
          <select
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-800"
            onChange={(event) => setReviewStatus(event.target.value as DraftReviewStatus | "all")}
            value={reviewStatus}
          >
            <option value="all">全部状态</option>
            {Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <p>共 {drafts.length} 个内容项目</p>
        {drafts.length !== initialDrafts.length ? <button className="font-semibold text-emerald-800" onClick={() => { setQuery(""); setChannel("all"); setReviewStatus("all"); }} type="button">清除筛选</button> : null}
      </div>

      {drafts.length ? (
        <div className="mt-3 grid gap-3">
          {drafts.map((draft) => (
            <Link
              className="group grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-700 hover:shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              href={`/drafts/${encodeURIComponent(draft.id)}`}
              key={draft.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusClass(draft.reviewStatus)}>{reviewLabels[draft.reviewStatus]}</span>
                  {draft.projectStatus === "partially_failed" || draft.projectStatus === "failed" ? <span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">有渠道生成失败</span> : null}
                </div>
                <h2 className="mt-3 truncate text-base font-semibold text-slate-900 group-hover:text-emerald-900">{draft.topic}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.generatedChannels.length ? draft.generatedChannels.map((item) => <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600" key={item}>{channelLabels[item]}</span>) : <span className="text-xs text-slate-400">尚未生成渠道内容</span>}
                </div>
                <p className="mt-3 text-xs text-slate-400">{draft.knowledgeSourceCount} 个知识来源 · 创建于 {formatDate(draft.createdAt)} · 修改于 {formatDate(draft.updatedAt)}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-800">继续编辑 →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-sm font-semibold text-slate-700">没有符合条件的草稿</p><p className="mt-2 text-xs text-slate-500">调整关键词、渠道或审核状态后再试。</p></div>
      )}
    </section>
  );
}

function EmptyDrafts() {
  return <section className="mt-7 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#e9f0ec] text-lg font-semibold text-emerald-900">稿</span><h2 className="mt-5 text-base font-semibold">还没有草稿</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">确认内容简报并生成渠道内容后，可以从这里重新打开。</p><Link className="mt-5 text-sm font-semibold text-emerald-800" href="/">开始写第一篇 →</Link></section>;
}

function statusClass(status: DraftReviewStatus) {
  return `rounded-lg px-2 py-1 text-[11px] font-semibold ${status === "approved" ? "bg-emerald-50 text-emerald-800" : status === "editing" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
