"use client";

import { useEffect, useState } from "react";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";
import type { MaterialRecord } from "@/lib/store";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadMaterials(); }, []);

  async function loadMaterials() {
    const response = await fetch("/api/materials", { cache: "no-store" });
    const payload = (await response.json()) as { materials?: MaterialRecord[] };
    setMaterials(payload.materials ?? []);
  }

  async function addFeishu() {
    if (!feishuUrl.trim()) return setMessage("请先粘贴飞书文档或多维表格链接");
    setBusy("feishu"); setMessage(null);
    try {
      const response = await fetch("/api/feishu/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: feishuUrl }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "读取飞书失败");
      setFeishuUrl(""); await loadMaterials(); setMessage("已加入素材库");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "读取飞书失败"); }
    finally { setBusy(null); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const data = new FormData(); Array.from(files).forEach((file) => data.append("files", file));
    setBusy("upload"); setMessage(null);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: data });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "上传失败");
      await loadMaterials(); setMessage("文件已加入素材库");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "上传失败"); }
    finally { setBusy(null); }
  }

  return (
    <AppShell active="/knowledge">
      <PageHeader eyebrow="KNOWLEDGE BASE" title="知识库" description="企业事实、产品、案例和观点放在这里。写作时由你选择需要引用的知识。" />

      <div className="mt-7 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">添加素材</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">文件仍保存在你自己的飞书或本地，系统只保存本次读取到的内容。</p>
          <label className="mt-6 grid gap-2 text-sm font-medium text-slate-700"><span>飞书文档或多维表格</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={feishuUrl} onChange={(event) => setFeishuUrl(event.target.value)} placeholder="粘贴 feishu.cn/docx 或 base 链接" /></label>
          <button className={`${primaryButtonClass} mt-3 w-full`} onClick={addFeishu} disabled={busy === "feishu"}>{busy === "feishu" ? "读取中…" : "读取并加入素材库"}</button>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-300"><span className="h-px flex-1 bg-slate-100" />或<span className="h-px flex-1 bg-slate-100" /></div>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600 hover:border-emerald-700"><span>{busy === "upload" ? "正在读取文件…" : "上传 TXT / MD / CSV"}</span><span className="text-lg">＋</span><input className="sr-only" type="file" multiple accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" onChange={(event) => upload(event.target.files)} /></label>
          {message ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-base font-semibold">可用素材</h2><p className="mt-1 text-xs text-slate-500">已连接并可用于内容生成</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{materials.length} 份</span></div>
          {materials.length ? <div className="divide-y divide-slate-100">{materials.map((material) => <article key={material.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-700">{sourceName(material.source)}</span><h3 className="truncate text-sm font-semibold">{material.title}</h3></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{material.text || "已连接，暂无可预览正文"}</p></div><p className="text-xs text-slate-400">{formatDate(material.createdAt)}</p></article>)}</div> : <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><span className="text-3xl">▤</span><h3 className="mt-4 text-sm font-semibold">素材库还是空的</h3><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">先连接一份飞书知识文档，之后写作时就能直接选择。</p></div>}
        </section>
      </div>
    </AppShell>
  );
}

function sourceName(source: MaterialRecord["source"]) { return source === "feishu" ? "飞书" : source === "base" ? "多维表格" : "本地文件"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
