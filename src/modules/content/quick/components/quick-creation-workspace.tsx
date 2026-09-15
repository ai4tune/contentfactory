"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { BriefKnowledgeSource, ContentChannel, ContentProject } from "@/modules/content/types";
import type { KnowledgeRecommendation, QuickKnowledgeCandidate } from "@/modules/content/quick/types";
import { loadLocalKnowledge, readLocalKnowledgeItem } from "@/modules/knowledge/local-index";
import type { LocalKnowledgeItem } from "@/modules/knowledge/types";

type CandidateSource = {
  id: string;
  title: string;
  source: BriefKnowledgeSource["source"];
  text?: string;
  excerpt?: string;
  url?: string;
  path?: string;
};

export function QuickCreationWorkspace({
  accountPosition,
  channel,
  contentPlanId,
  contentPlanItemId,
  itemAngle,
  itemRationale,
}: {
  accountPosition: string;
  channel: ContentChannel;
  contentPlanId: string;
  contentPlanItemId: string;
  itemAngle?: string;
  itemRationale: string;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<CandidateSource[]>([]);
  const [recommendations, setRecommendations] = useState<KnowledgeRecommendation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/materials", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { materials?: CandidateSource[] }) => payload.materials ?? []),
      fetch("/api/knowledge-sources", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { sources?: CandidateSource[] }) => payload.sources ?? []),
      loadLocalKnowledge().catch(() => []),
    ])
      .then(async ([materials, remoteSources, localItems]) => {
        const candidates = uniqueSources([
          ...localItems.map(localItemToSource),
          ...remoteSources,
          ...materials,
        ]);
        if (cancelled) return;
        setSources(candidates);
        if (candidates.length) {
          try {
            const matched = await requestRecommendations(contentPlanId, contentPlanItemId, candidates);
            if (!cancelled) setRecommendations(matched.length ? matched : manualRecommendations(candidates));
          } catch (error) {
            if (!cancelled) {
              setRecommendations(manualRecommendations(candidates));
              setMessage(error instanceof Error ? `${error.message} 你仍可手工选择资料。` : "AI 资料匹配失败，你仍可手工选择资料。");
            }
          }
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "企业资料读取失败。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contentPlanId, contentPlanItemId]);

  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [sourceKey(source.source, source.id), source])),
    [sources],
  );
  const selected = recommendations.filter((item) => item.selected);
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const visibleRecommendations = recommendations.filter((item) => {
    if (!normalizedQuery) return true;
    const source = sourceMap.get(sourceKey(item.sourceType, item.refId));
    return [item.title, item.reason, source?.path, source?.excerpt]
      .some((value) => value?.toLocaleLowerCase("zh-CN").includes(normalizedQuery));
  });

  async function rematch() {
    if (!sources.length) return;
    setMatching(true);
    setMessage(null);
    try {
      const matched = await requestRecommendations(contentPlanId, contentPlanItemId, sources);
      setRecommendations(matched.length ? matched : manualRecommendations(sources));
    } catch (error) {
      if (!recommendations.length) setRecommendations(manualRecommendations(sources));
      setMessage(error instanceof Error ? error.message : "AI 资料匹配失败，可手工选择资料。");
    } finally {
      setMatching(false);
    }
  }

  function toggleRecommendation(target: KnowledgeRecommendation) {
    setRecommendations((items) => items.map((item) => (
      item.refId === target.refId && item.sourceType === target.sourceType
        ? { ...item, selected: !item.selected }
        : item
    )));
  }

  async function generate() {
    if (!selected.length) {
      setMessage("请至少确认一份企业资料。资料不足时，系统不会把内容标记为已有事实依据。");
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const selectedSources = await Promise.all(selected.map(async (choice) => {
        const source = sourceMap.get(sourceKey(choice.sourceType, choice.refId));
        if (!source) throw new Error(`找不到资料：${choice.title}`);
        return readFullSource(source);
      }));
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        "/api/content/quick/generate",
        { contentPlanId, contentPlanItemId, channel, sources: selectedSources },
      );
      if (!payload.project) throw new Error("没有生成可用的待审核稿。");
      router.push(`/drafts/${encodeURIComponent(payload.project.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "快速创作失败，请重试。");
      setGenerating(false);
    }
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.76fr_1.24fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold text-emerald-800">已自动继承</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">计划与账号上下文</h2>
        <dl className="mt-5 grid gap-4 text-sm">
          <Info label="账号定位" value={accountPosition} />
          <Info label="选题角度" value={itemAngle || "沿用计划推荐角度"} />
          <Info label="推荐理由" value={itemRationale} />
        </dl>
        <div className="mt-6 rounded-2xl bg-[#f5ecd9] p-4 text-xs leading-6 text-[#6f551f]">
          这里只生成当前主渠道的一篇稿件。多渠道、爆款改写和临时风格调整仍在高级创作中完成。
        </div>
        <Link className={`${secondaryButtonClass} mt-5 w-full`} href="/create">进入高级创作</Link>
      </aside>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800">第 1 步</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">确认本次使用的企业资料</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">AI 只根据资料标题和索引摘要做匹配；点击生成后，才会读取并发送你最终选中的正文。</p>
          </div>
          <button className={secondaryButtonClass} disabled={loading || matching || generating || !sources.length} onClick={rematch} type="button">
            {matching ? "正在重新匹配" : "重新匹配"}
          </button>
        </div>

        {loading ? <LoadingState /> : sources.length ? (
          <>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="min-w-0 flex-1">
                <span className="sr-only">筛选企业资料</span>
                <input className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700" onChange={(event) => setQuery(event.target.value)} placeholder="按标题或内容摘要筛选" value={query} />
              </label>
              <p className="shrink-0 text-xs text-slate-500">已选择 {selected.length} 份，共 {sources.length} 份可用</p>
            </div>
            {recommendations.length ? (
              <div className="mt-4 grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
                {visibleRecommendations.map((item) => (
                  <RecommendationCard item={item} key={sourceKey(item.sourceType, item.refId)} onToggle={() => toggleRecommendation(item)} />
                ))}
                {!visibleRecommendations.length ? <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">没有符合当前筛选词的资料。</p> : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-950">AI 暂未返回匹配结果</p>
                <p className="mt-2 text-xs leading-5 text-amber-800">可以点击“重新匹配”；如果 AI 服务不可用，请进入高级创作手工选择资料。</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-7 text-center">
            <p className="text-sm font-semibold text-slate-800">还没有可用的企业资料</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">先连接本地文件夹或飞书，系统才有事实依据生成可发布内容。</p>
            <Link className={`${secondaryButtonClass} mt-4`} href="/knowledge">连接企业知识库</Link>
          </div>
        )}

        {message ? <p aria-live="polite" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{message}</p> : null}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold text-emerald-800">第 2 步</p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">生成主渠道稿并自动审核</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">系统会依次生成统一简报、主渠道稿和事实/风格/平台审核，完成后直接进入人工审核页。</p>
          <button className={`${primaryButtonClass} mt-4 w-full`} disabled={loading || matching || generating || !selected.length} onClick={generate} type="button">
            {generating ? "正在生成简报、主渠道稿并审核" : "确认资料并生成待审核稿"}
          </button>
        </div>
      </div>
    </section>
  );
}

function RecommendationCard({ item, onToggle }: { item: KnowledgeRecommendation; onToggle: () => void }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${item.selected ? "border-emerald-700/40 bg-[#f4faf7]" : "border-slate-200 hover:bg-slate-50"}`}>
      <input checked={item.selected} className="mt-1 size-4 accent-emerald-800" onChange={onToggle} type="checkbox" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{item.title}</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{sourceLabel(item.sourceType)}</span>
          {item.selected ? <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">已选择</span> : null}
        </span>
        <span className="mt-2 block text-xs leading-5 text-slate-600">{item.reason}</span>
        {item.excerpts[0] ? <span className="mt-2 line-clamp-2 block rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-500">{item.excerpts[0]}</span> : null}
      </span>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1.5 leading-6 text-slate-700">{value}</dd></div>;
}

function LoadingState() {
  return <div className="mt-5 rounded-2xl bg-slate-50 p-6"><p className="text-sm font-semibold text-slate-700">正在读取知识索引并匹配资料…</p><p className="mt-2 text-xs text-slate-500">不会在这一步读取本地文件全文。</p></div>;
}

async function requestRecommendations(contentPlanId: string, contentPlanItemId: string, sources: CandidateSource[]) {
  const candidates: QuickKnowledgeCandidate[] = sources.map((source) => ({
    refId: source.id,
    title: source.title,
    sourceType: source.source,
    excerpt: (source.excerpt || source.text || "").slice(0, 1_600),
    url: source.url,
    path: source.path,
  }));
  const payload = await postJson<{ recommendations?: KnowledgeRecommendation[]; error?: string }>(
    "/api/content/quick/knowledge",
    { contentPlanId, contentPlanItemId, candidates },
  );
  return payload.recommendations ?? [];
}

async function readFullSource(source: CandidateSource): Promise<BriefKnowledgeSource> {
  if (source.source === "local") {
    return { ...source, text: await readLocalKnowledgeItem(source.id) };
  }
  if (source.text?.trim()) return source as BriefKnowledgeSource;

  const response = source.source === "base" && source.url
    ? await fetch("/api/integrations/feishu/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: source.url }),
      })
    : await fetch(`/api/integrations/feishu/documents/${encodeURIComponent(source.id)}`);
  const payload = await response.json() as { document?: BriefKnowledgeSource; error?: string };
  if (!response.ok || !payload.document) throw new Error(payload.error ?? `读取资料“${source.title}”失败。`);
  return payload.document;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "操作失败，请重试。");
  return payload;
}

function localItemToSource(item: LocalKnowledgeItem): CandidateSource {
  return { id: item.id, title: item.title, source: "local", path: item.path, excerpt: item.excerpt };
}

function uniqueSources(sources: CandidateSource[]) {
  return [...new Map(sources.map((source) => [sourceKey(source.source, source.id), source])).values()];
}

function manualRecommendations(sources: CandidateSource[]): KnowledgeRecommendation[] {
  return sources.map((source) => ({
    refId: source.id,
    title: source.title,
    sourceType: source.source,
    reason: "AI 暂未完成匹配，请根据本次选题手工确认是否采用。",
    excerpts: (source.excerpt || source.text) ? [(source.excerpt || source.text || "").slice(0, 260)] : [],
    selected: false,
  }));
}

function sourceKey(source: BriefKnowledgeSource["source"], id: string) {
  return `${source}:${id}`;
}

function sourceLabel(source: BriefKnowledgeSource["source"]) {
  return { local: "本地文件", feishu: "飞书文档", base: "飞书多维表格", upload: "临时资料" }[source];
}
