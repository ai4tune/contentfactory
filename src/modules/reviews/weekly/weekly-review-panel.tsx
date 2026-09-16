"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { WeeklyReview, ReviewSuggestion } from "./types";

export function WeeklyReviewPanel({
  contentPlanId,
  weeks,
  initialReviews,
}: {
  contentPlanId: string;
  weeks: number[];
  initialReviews: WeeklyReview[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [week, setWeek] = useState(weeks[0] ?? 1);
  const [busy, setBusy] = useState<"generate" | "confirm" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const review = reviews.find((item) => item.week === week);

  async function run(action: "generate" | "confirm") {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/content-plans/${encodeURIComponent(contentPlanId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "confirm"
          ? { action, reviewId: review?.id }
          : { week }),
      });
      const payload = await response.json() as { review?: WeeklyReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error ?? "周复盘操作失败。");
      setReviews((current) => [payload.review!, ...current.filter((item) => item.id !== payload.review!.id)]);
      setMessage(action === "confirm" ? "本周复盘已确认，相关计划项已标记为已复盘。" : "本周复盘已更新。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "周复盘操作失败。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald-800">WEEKLY REVIEW</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">本周复盘与下周建议</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">只使用已经回填的真实发布数据。少于 2 条有效记录时，只提示还缺什么。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="选择复盘周次" className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm" onChange={(event) => setWeek(Number(event.target.value))} value={week}>
            {weeks.map((item) => <option key={item} value={item}>第 {item} 周</option>)}
          </select>
          <button className={secondaryButtonClass} disabled={busy !== null} onClick={() => void run("generate")} type="button">{busy === "generate" ? "复盘中" : review ? "重新复盘" : "生成复盘"}</button>
          {review && !review.confirmedAt && review.sampleSize > 0 ? <button className={primaryButtonClass} disabled={busy !== null} onClick={() => void run("confirm")} type="button">{busy === "confirm" ? "确认中" : "确认复盘"}</button> : null}
        </div>
      </div>

      {review ? (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">真实样本 {review.sampleSize} 条</span>
            <span className={`rounded-lg px-2.5 py-1.5 ${review.confirmedAt ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{review.confirmedAt ? "已确认" : "待确认"}</span>
          </div>
          {review.dataGaps.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">数据不足或仍有缺口</p><ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-900">{review.dataGaps.map((gap) => <li key={gap}>· {gap}</li>)}</ul></div> : null}
          {review.sampleSize >= 2 ? <div className="mt-4 grid gap-4 xl:grid-cols-3"><SuggestionGroup items={review.continue} label="继续" tone="emerald" /><SuggestionGroup items={review.reduce} label="减少" tone="rose" /><SuggestionGroup items={review.adjust} label="调整" tone="amber" /></div> : null}
        </div>
      ) : <p className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">还没有第 {week} 周复盘。先在上方内容列表补充真实发布结果，再生成复盘。</p>}
      {message ? <p aria-live="polite" className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}

function SuggestionGroup({ items, label, tone }: { items: ReviewSuggestion[]; label: string; tone: "emerald" | "rose" | "amber" }) {
  const toneClass = { emerald: "text-emerald-800", rose: "text-rose-700", amber: "text-amber-800" }[tone];
  return <div className="rounded-xl border border-slate-200 p-4"><h3 className={`text-sm font-semibold ${toneClass}`}>{label}</h3>{items.length ? <div className="mt-3 grid gap-4">{items.map((item) => <article key={`${item.title}:${item.evidence[0]?.publicationId}`}><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.rationale}</p><div className="mt-2 grid gap-1">{item.evidence.map((evidence) => <p className="text-[11px] leading-5 text-slate-400" key={`${evidence.contentPlanItemId}:${evidence.publicationId}`}>依据：{evidence.label}</p>)}</div></article>)}</div> : <p className="mt-3 text-xs text-slate-400">本周暂无有依据的建议。</p>}</div>;
}
