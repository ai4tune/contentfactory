"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, contentChannels, type ContentChannel } from "@/modules/content/types";
import type { ContentDraft } from "../types";

export function DraftDetail({ initialDraft }: { initialDraft: ContentDraft }) {
  const firstChannel = initialDraft.channelDrafts.find((item) => item.status === "generated")?.channel ?? contentChannels[0];
  const [draft, setDraft] = useState(initialDraft);
  const [activeChannel, setActiveChannel] = useState<ContentChannel>(firstChannel);
  const [edits, setEdits] = useState<Record<string, string>>(() => Object.fromEntries(initialDraft.channelDrafts.map((item) => [item.channel, item.content])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const channelDraft = draft.channelDrafts.find((item) => item.channel === activeChannel);
  const content = edits[activeChannel] ?? "";
  const changed = Boolean(channelDraft && content !== channelDraft.content);
  const versions = useMemo(() => draft.versions.filter((item) => item.channel === activeChannel).reverse(), [activeChannel, draft.versions]);

  async function save() {
    if (!channelDraft || !content.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/content-drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: activeChannel, content }),
      });
      const payload = (await response.json()) as { draft?: ContentDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error ?? "草稿保存失败");
      setDraft(payload.draft);
      setEdits((current) => ({ ...current, [activeChannel]: payload.draft?.channelDrafts.find((item) => item.channel === activeChannel)?.content ?? content }));
      setMessage("已保存，并保留上一版快照。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "草稿保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setMessage(`已复制${channelLabels[activeChannel]}。`);
    } catch {
      setMessage("复制失败，请手工选择文本复制。");
    }
  }

  return (
    <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2">
          {contentChannels.map((channel) => {
            const item = draft.channelDrafts.find((candidate) => candidate.channel === channel);
            return <button className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${channel === activeChannel ? "bg-emerald-900 text-white" : item?.status === "failed" ? "bg-red-50 text-red-700" : item ? "bg-slate-100 text-slate-600" : "text-slate-400"}`} key={channel} onClick={() => { setActiveChannel(channel); setMessage(null); }} type="button">{channelLabels[channel]}{item ? item.status === "failed" ? " · 失败" : " · 已生成" : " · 未生成"}</button>;
          })}
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900">{channelLabels[activeChannel]}</h2><p className="mt-1 text-xs text-slate-500">最后修改：{formatDate(channelDraft?.updatedAt ?? draft.updatedAt)}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className={secondaryButtonClass} disabled={!content} onClick={copy} type="button">复制</button>
              <a className={secondaryButtonClass} href={`/api/content-drafts/${encodeURIComponent(draft.id)}/export?channel=${activeChannel}`}>下载本渠道</a>
              <a className={secondaryButtonClass} href={`/api/content-drafts/${encodeURIComponent(draft.id)}/export`}>下载全部</a>
            </div>
          </div>

          {channelDraft?.status === "generated" ? (
            <>
              <textarea
                className="mt-5 min-h-[560px] w-full resize-y rounded-xl border border-slate-300 px-4 py-4 text-sm leading-7 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
                onChange={(event) => setEdits((current) => ({ ...current, [activeChannel]: event.target.value }))}
                value={content}
              />
              {activeChannel === "xiaohongshu_note" && channelDraft.visualAssets?.length ? (
                <DraftVisualAssets
                  assets={channelDraft.visualAssets}
                  draftId={draft.id}
                />
              ) : null}
            </>
          ) : channelDraft?.status === "failed" ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">{channelDraft.error || "该渠道生成失败，请返回创作页重新生成。"}</div>
          ) : (
            <div className="mt-5 flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">该渠道还没有内容。</div>
          )}

          {message ? <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700" role="status">{message}</p> : null}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">{changed ? "有尚未保存的修改" : `已保存 ${versions.length + (channelDraft ? 1 : 0)} 个版本`}</p>
            <button className={primaryButtonClass} disabled={!changed || !content.trim() || busy} onClick={save} type="button">{busy ? "正在保存" : "保存新版本"}</button>
          </div>
        </div>
      </section>

      <aside className="grid gap-4">
        <InfoCard title="草稿状态">
          <dl className="grid grid-cols-2 gap-3 text-xs"><Metric label="审核状态" value={reviewLabel(draft.reviewStatus)} /><Metric label="知识来源" value={`${draft.selectedKnowledgeRefs.length} 个`} /><Metric label="创建时间" value={formatDate(draft.createdAt)} /><Metric label="最后修改" value={formatDate(draft.updatedAt)} /></dl>
        </InfoCard>
        <InfoCard title="统一内容简报">
          <InfoRow label="目标受众" value={draft.brief.targetAudience} /><InfoRow label="内容目标" value={draft.brief.contentGoal} /><InfoRow label="核心观点" value={draft.brief.coreMessage} /><InfoRow label="行动引导" value={draft.brief.callToAction} />
          <ListBlock label="关键论点" items={draft.brief.keyPoints} />
          <ListBlock label="内容结构" items={draft.brief.outline} />
        </InfoCard>
        <InfoCard title={`引用来源 · ${draft.brief.citations.length}`}>
          {draft.brief.citations.length ? <div className="grid gap-3">{draft.brief.citations.map((citation) => <article className="rounded-xl bg-slate-50 p-3" key={`${citation.sourceId}:${citation.excerpt}`}><p className="text-xs font-semibold text-slate-800">{citation.sourceTitle}</p><p className="mt-2 text-xs leading-5 text-slate-600">“{citation.excerpt}”</p><p className="mt-2 text-[11px] text-slate-400">用途：{citation.purpose}</p></article>)}</div> : <p className="text-xs text-slate-400">暂无引用。</p>}
        </InfoCard>
        <InfoCard title={`历史版本 · ${versions.length}`}>
          {versions.length ? <div className="grid gap-2">{versions.map((version, index) => <button className="rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-700" key={version.id} onClick={() => setEdits((current) => ({ ...current, [activeChannel]: version.content }))} type="button"><p className="text-xs font-semibold text-slate-700">历史版本 {versions.length - index}</p><p className="mt-1 text-[11px] text-slate-400">{formatDate(version.createdAt)} · 点击载入编辑器</p></button>)}</div> : <p className="text-xs leading-5 text-slate-400">首次修改保存后，这里会保留上一版内容。</p>}
        </InfoCard>
      </aside>
    </div>
  );
}

function DraftVisualAssets({
  assets,
  draftId,
}: {
  assets: NonNullable<ContentDraft["channelDrafts"][number]["visualAssets"]>;
  draftId: string;
}) {
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">小红书配图</h3>
        <p className="mt-1 text-xs text-slate-500">配图已随草稿保存，可逐张下载后人工发布。</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {assets.map((asset) => (
          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white" key={asset.id}>
            {asset.status === "generated" && asset.imageUrl ? (
              <Image
                alt={asset.title}
                className="aspect-[2/3] w-full bg-slate-100 object-cover"
                height={1536}
                sizes="(min-width: 640px) 320px, 90vw"
                src={asset.imageUrl}
                width={1024}
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center bg-red-50 p-5 text-center text-xs text-red-700">
                {asset.error || "图片生成失败"}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-[10px] font-semibold text-emerald-700">{asset.kind === "cover" ? "封面" : "图文卡片"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{asset.title}</p>
              </div>
              {asset.status === "generated" ? (
                <a
                  className={secondaryButtonClass}
                  href={`/api/content/projects/${encodeURIComponent(draftId)}/channels/xiaohongshu_note/images/${encodeURIComponent(asset.id)}`}
                >
                  下载
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">{title}</h2><div className="mt-4">{children}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-700">{value}</dd></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="mb-3"><p className="text-[11px] font-semibold text-slate-400">{label}</p><p className="mt-1 text-xs leading-5 text-slate-700">{value || "待补充"}</p></div>; }
function ListBlock({ label, items }: { label: string; items: string[] }) { return <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[11px] font-semibold text-slate-400">{label}</p>{items.length ? <ul className="mt-2 grid gap-1.5">{items.map((item) => <li className="flex gap-2 text-xs leading-5 text-slate-600" key={item}><span className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">暂无</p>}</div>; }
function reviewLabel(status: ContentDraft["reviewStatus"]) { return { draft: "待人工审核", editing: "编辑中", approved: "已确认" }[status]; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
