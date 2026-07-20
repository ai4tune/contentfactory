"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import {
  chooseKnowledgeDirectory,
  disconnectKnowledgeDirectory,
  loadLocalKnowledge,
  readLocalKnowledgeItem,
  reconnectKnowledgeDirectory,
  refreshStoredDirectory,
  requestStoredDirectoryPermission,
  searchLocalKnowledge,
  supportsDirectoryPicker,
} from "../local-index";
import type { KnowledgePreview, LocalKnowledgeItem, RemoteKnowledgeSource } from "../types";

type FeishuItem = Omit<RemoteKnowledgeSource, "updatedAt"> & { text?: string };

export function KnowledgeWorkspace() {
  const [localItems, setLocalItems] = useState<LocalKnowledgeItem[]>([]);
  const [remoteSources, setRemoteSources] = useState<RemoteKnowledgeSource[]>([]);
  const [feishuResults, setFeishuResults] = useState<FeishuItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [permission, setPermission] = useState<PermissionState | "none" | "unsupported">("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const localResults = useMemo(() => searchLocalKnowledge(localItems, query), [localItems, query]);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!supportsDirectoryPicker()) return setPermission("unsupported");
      try {
        const cached = await loadLocalKnowledge();
        const restored = await reconnectKnowledgeDirectory();
        if (!active) return;
        setLocalItems(restored?.items ?? cached);
        setPermission(restored?.permission ?? "none");
      } catch {
        if (active) setMessage("本地索引恢复失败，请重新选择知识库文件夹。");
      }
    }
    void restore();
    void loadRemoteSources().then((sources) => active && setRemoteSources(sources));
    return () => { active = false; };
  }, []);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError"
        ? "没有选择文件夹，原有连接保持不变。"
        : error instanceof Error ? error.message : "操作失败，请重试。");
    } finally {
      setBusy(null);
    }
  }

  async function chooseDirectory() {
    await run("choose", async () => {
      const items = await chooseKnowledgeDirectory();
      setLocalItems(items);
      setPermission("granted");
      setMessage(`已在当前浏览器建立 ${items.length} 份资料的轻量索引。`);
    });
  }

  async function refreshDirectory() {
    await run("refresh", async () => {
      const items = await refreshStoredDirectory();
      setLocalItems(items);
      setMessage(`索引已刷新，共 ${items.length} 份资料。`);
    });
  }

  async function grantPermission() {
    await run("grant", async () => {
      setLocalItems(await requestStoredDirectoryPermission());
      setPermission("granted");
      setMessage("文件夹读取权限已恢复。");
    });
  }

  async function disconnectDirectory() {
    await run("disconnect", async () => {
      await disconnectKnowledgeDirectory();
      setLocalItems([]);
      setSelectedIds((ids) => ids.filter((id) => !id.startsWith("local:")));
      setPermission("none");
      if (preview?.source === "local") setPreview(null);
      setMessage("已移除浏览器中保存的目录句柄和本地索引。可在浏览器站点设置中撤销授权。");
    });
  }

  async function previewLocal(item: LocalKnowledgeItem) {
    await run(`preview:${item.id}`, async () => setPreview({
      id: item.id,
      title: item.title,
      source: "local",
      text: await readLocalKnowledgeItem(item.id),
      path: item.path,
      lastModified: item.lastModified,
    }));
  }

  async function searchFeishu() {
    if (!query.trim()) return setMessage("请输入关键词后再搜索飞书。");
    await run("search", async () => {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = (await response.json()) as { items?: FeishuItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "飞书搜索失败。");
      setFeishuResults(payload.items ?? []);
      if (!payload.items?.length) setMessage("飞书中没有找到匹配的文档。");
    });
  }

  async function resolveFeishu() {
    if (!feishuUrl.trim()) return setMessage("请粘贴飞书 docx 或 base 链接。");
    await run("resolve", async () => {
      const document = await fetchFeishu("/api/integrations/feishu/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feishuUrl }),
      });
      setPreview(toPreview(document));
      setFeishuUrl("");
      setRemoteSources(await loadRemoteSources());
      setMessage("飞书知识源已连接，服务端只保存来源标识和更新时间。");
    });
  }

  async function previewRemote(item: FeishuItem | RemoteKnowledgeSource) {
    await run(`preview:${item.id}`, async () => {
      const document = item.source === "base" && item.url
        ? await fetchFeishu("/api/integrations/feishu/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: item.url }),
          })
        : await fetchFeishu(`/api/integrations/feishu/documents/${encodeURIComponent(item.id)}`);
      setPreview(toPreview(document));
      setRemoteSources(await loadRemoteSources());
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await run("upload", async () => {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = (await response.json()) as { sources?: FeishuItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "文件上传失败。");
      const first = payload.sources?.[0];
      if (first) setPreview(toPreview(first));
      setMessage(`已通过兼容入口读取 ${payload.sources?.length ?? 0} 份文件。`);
    });
  }

  function toggle(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  return <AppShell active="/knowledge">
    <PageHeader eyebrow="CUSTOMER-OWNED KNOWLEDGE" title="知识库" description="连接本地 Markdown / TXT 与飞书资料。本地目录索引留在当前浏览器，正文按需读取。" actions={<span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">已选择 {selectedIds.length} 份</span>} />
    {message ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}

    <div className="mt-6 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="space-y-5">
        <Panel title="本地文件夹" description="默认方式。浏览器直接读取，不把完整目录复制到服务端。">
          {permission === "unsupported" ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">请使用桌面版 Chrome 或 Edge 连接文件夹。</p> : <div className="flex flex-wrap gap-2">
            <button className={primaryButtonClass} disabled={busy !== null} onClick={chooseDirectory}>{busy === "choose" ? "建立索引中…" : "选择知识库文件夹"}</button>
            {(permission === "prompt" || permission === "denied") ? <button className={secondaryButtonClass} disabled={busy !== null} onClick={grantPermission}>重新授权</button> : null}
            {permission === "granted" ? <button className={secondaryButtonClass} disabled={busy !== null} onClick={refreshDirectory}>刷新索引</button> : null}
            {localItems.length ? <button className={secondaryButtonClass} disabled={busy !== null} onClick={disconnectDirectory}>移除连接</button> : null}
          </div>}
          <p className="mt-3 text-xs leading-5 text-slate-500">{localItems.length ? `已索引 ${localItems.length} 份 .md / .txt，预览时才读取完整正文。` : "支持递归读取子文件夹，换设备后需要重新选择。"}</p>
        </Panel>

        <Panel title="飞书知识" description="连接已授权的飞书文档或多维表格。">
          <label className="grid gap-2 text-sm font-medium text-slate-700"><span>飞书链接</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={feishuUrl} onChange={(event) => setFeishuUrl(event.target.value)} placeholder="https://*.feishu.cn/docx/..." /></label>
          <button className={`${primaryButtonClass} mt-3 w-full`} disabled={busy !== null} onClick={resolveFeishu}>{busy === "resolve" ? "读取中…" : "连接并预览"}</button>
          {remoteSources.length ? <div className="mt-4 space-y-2">{remoteSources.map((item) => <RemoteRow key={`${item.source}:${item.id}`} item={item} busy={busy} selected={selectedIds.includes(item.id)} onPreview={() => previewRemote(item)} onToggle={() => toggle(item.id)} />)}</div> : null}
        </Panel>

        <Panel title="文件上传（兼容入口）" description="仅在目录授权或飞书不可用时临时使用。">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600"><span>{busy === "upload" ? "读取中…" : "上传 Markdown / TXT"}</span><span>＋</span><input className="sr-only" type="file" multiple accept=".md,.txt,text/markdown,text/plain" onChange={(event) => upload(event.target.files)} /></label>
        </Panel>
      </div>

      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-2 sm:flex-row"><label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-slate-700"><span>搜索知识</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题、标签或正文关键词" /></label><button className={`${secondaryButtonClass} self-end`} disabled={busy !== null} onClick={searchFeishu}>{busy === "search" ? "搜索飞书中…" : "同时搜索飞书"}</button></div><p className="mt-2 text-xs text-slate-500">本地搜索只在浏览器内完成。</p></div>
          <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100">
            {localResults.map((item) => <LocalRow key={item.id} item={item} busy={busy} selected={selectedIds.includes(item.id)} onPreview={() => previewLocal(item)} onToggle={() => toggle(item.id)} />)}
            {feishuResults.map((item) => <RemoteRow key={`${item.source}:${item.id}`} item={item} busy={busy} selected={selectedIds.includes(item.id)} onPreview={() => previewRemote(item)} onToggle={() => toggle(item.id)} />)}
            {!localResults.length && !feishuResults.length ? <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><h3 className="text-sm font-semibold">暂无资料</h3><p className="mt-2 text-xs text-slate-500">先连接本地文件夹，或输入关键词搜索飞书。</p></div> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold">正文预览</h2><p className="mt-1 text-xs text-slate-500">按需读取，不保存本地目录副本</p></div>{preview ? <SelectButton selected={selectedIds.includes(preview.id)} onClick={() => toggle(preview.id)} /> : null}</div>{preview ? <div className="p-5"><div className="flex items-center gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{sourceName(preview.source)}</span><h3 className="text-sm font-semibold">{preview.title}</h3></div>{preview.path ? <p className="mt-2 text-xs text-slate-400">{preview.path}</p> : null}<pre className="mt-4 max-h-[430px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-xs leading-6 text-slate-700">{preview.text || "没有可预览的正文。"}</pre></div> : <div className="flex min-h-56 items-center justify-center p-6 text-sm text-slate-400">点击一份资料查看正文</div>}</section>
      </div>
    </div>
  </AppShell>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">{title}</h2><p className="mb-4 mt-2 text-xs leading-5 text-slate-500">{description}</p>{children}</section>;
}

function LocalRow({ item, busy, selected, onPreview, onToggle }: { item: LocalKnowledgeItem; busy: string | null; selected: boolean; onPreview: () => void; onToggle: () => void }) {
  return <article className="flex items-start gap-3 p-4"><button className="min-w-0 flex-1 text-left" disabled={busy !== null} onClick={onPreview}><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-400">本地 · {item.path}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">{item.excerpt || "空文件"}</span></button><SelectButton selected={selected} onClick={onToggle} /></article>;
}

function RemoteRow({ item, busy, selected, onPreview, onToggle }: { item: FeishuItem | RemoteKnowledgeSource; busy: string | null; selected: boolean; onPreview: () => void; onToggle: () => void }) {
  return <article className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><button className="min-w-0 flex-1 text-left" disabled={busy !== null} onClick={onPreview}><span className="block text-[10px] font-semibold text-emerald-700">{item.source === "base" ? "飞书多维表格" : "飞书文档"}</span><span className="mt-1 block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-400">{busy === `preview:${item.id}` ? "读取正文中…" : item.id}</span></button><SelectButton selected={selected} onClick={onToggle} /></article>;
}

function SelectButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return <button className={selected ? `${primaryButtonClass} min-h-8 px-3 text-xs` : `${secondaryButtonClass} min-h-8 px-3 text-xs`} onClick={onClick}>{selected ? "已选择" : "选择"}</button>;
}

async function loadRemoteSources() {
  const response = await fetch("/api/knowledge-sources", { cache: "no-store" });
  const payload = (await response.json()) as { sources?: RemoteKnowledgeSource[] };
  return payload.sources ?? [];
}

async function fetchFeishu(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as { document?: FeishuItem; error?: string };
  if (!response.ok || !payload.document) throw new Error(payload.error ?? "飞书知识读取失败。");
  return payload.document;
}

function toPreview(item: FeishuItem): KnowledgePreview {
  return { id: item.id, title: item.title, source: item.source, text: item.text ?? "", url: item.url };
}

function sourceName(source: KnowledgePreview["source"]) {
  return source === "local" ? "本地" : source === "base" ? "飞书多维表格" : source === "feishu" ? "飞书文档" : "兼容上传";
}
