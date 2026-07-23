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
  const displayedRemoteResults = query.trim() ? feishuResults : remoteSources;

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

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">知识来源</h2>
          <p className="mt-1 text-xs text-slate-500">需要新增或更新资料时再使用这些入口。</p>
        </div>
        <span className="text-xs text-slate-400">{localItems.length + remoteSources.length} 个可用来源</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.12fr_1fr_0.68fr]">
        <section className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">本地文件夹</h3>
              <p className="mt-1 text-xs text-slate-500">{localItems.length ? `已索引 ${localItems.length} 份资料` : "浏览器内建立轻量索引"}</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${permission === "granted" ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500"}`}>
              {permission === "granted" ? "已连接" : "未连接"}
            </span>
          </div>
          {permission === "unsupported" ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">请使用桌面版 Chrome 或 Edge。</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={`${primaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={chooseDirectory}>
                {busy === "choose" ? "建立索引中…" : localItems.length ? "更换文件夹" : "选择文件夹"}
              </button>
              {(permission === "prompt" || permission === "denied") ? <button className={`${secondaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={grantPermission}>重新授权</button> : null}
              {permission === "granted" ? <button className={`${secondaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={refreshDirectory}>刷新</button> : null}
              {localItems.length ? <button className="min-h-9 px-2 text-xs font-semibold text-slate-500 hover:text-slate-800" disabled={busy !== null} onClick={disconnectDirectory}>移除</button> : null}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">飞书知识</h3>
              <p className="mt-1 text-xs text-slate-500">{remoteSources.length ? `已连接 ${remoteSources.length} 个来源` : "按链接连接文档或多维表格"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">飞书文档或多维表格链接</span>
              <input className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" value={feishuUrl} onChange={(event) => setFeishuUrl(event.target.value)} placeholder="粘贴飞书链接" />
            </label>
            <button className={`${secondaryButtonClass} min-h-9 shrink-0 px-3 text-xs`} disabled={busy !== null} onClick={resolveFeishu}>
              {busy === "resolve" ? "读取中…" : "连接"}
            </button>
          </div>
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">文件上传</h3>
          <p className="mt-1 text-xs text-slate-500">临时兼容入口</p>
          <label className="mt-3 flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-700 hover:text-emerald-800">
            <span>{busy === "upload" ? "读取中…" : "上传 MD / TXT"}</span>
            <input className="sr-only" type="file" multiple accept=".md,.txt,text/markdown,text/plain" onChange={(event) => upload(event.target.files)} />
          </label>
        </section>
      </div>
    </section>

    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">搜索与选择</h2>
              <p className="mt-1 text-xs text-slate-500">本地资料即时过滤，飞书资料按需搜索。</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{localResults.length + displayedRemoteResults.length} 条结果</span>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">搜索知识</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、标签或正文关键词" />
            </label>
            <button className={`${secondaryButtonClass} shrink-0`} disabled={busy !== null} onClick={searchFeishu}>{busy === "search" ? "搜索飞书中…" : "搜索飞书"}</button>
          </div>
        </div>
        <div className="min-h-[420px] max-h-[calc(100dvh-320px)] divide-y divide-slate-100 overflow-y-auto">
          {localResults.map((item) => <LocalRow key={item.id} item={item} busy={busy} selected={selectedIds.includes(item.id)} onPreview={() => previewLocal(item)} onToggle={() => toggle(item.id)} />)}
          {displayedRemoteResults.map((item) => <RemoteRow key={`${item.source}:${item.id}`} item={item} busy={busy} selected={selectedIds.includes(item.id)} onPreview={() => previewRemote(item)} onToggle={() => toggle(item.id)} />)}
          {!localResults.length && !displayedRemoteResults.length ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <h3 className="text-sm font-semibold text-slate-800">{query.trim() ? "没有匹配的资料" : "知识库还是空的"}</h3>
              <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{query.trim() ? "换一个关键词，或点击“搜索飞书”查询远程资料。" : "从上方连接本地文件夹、飞书，或临时上传文件。"}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">正文预览</h2>
            <p className="mt-1 text-xs text-slate-500">按需读取，不保存本地目录副本</p>
          </div>
          {preview ? <SelectButton selected={selectedIds.includes(preview.id)} onClick={() => toggle(preview.id)} /> : null}
        </div>
        {preview ? (
          <div className="p-5">
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{sourceName(preview.source)}</span>
              <h3 className="min-w-0 text-sm font-semibold leading-6 text-slate-900">{preview.title}</h3>
            </div>
            {preview.path ? <p className="mt-2 break-all text-xs text-slate-400">{preview.path}</p> : null}
            <pre className="mt-4 max-h-[calc(100dvh-300px)] min-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-xs leading-6 text-slate-700">{preview.text || "没有可预览的正文。"}</pre>
          </div>
        ) : (
          <div className="flex min-h-[520px] flex-col items-center justify-center p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e9f0ec] text-sm font-semibold text-emerald-900">阅</div>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">选择资料后在这里阅读</h3>
            <p className="mt-2 text-xs text-slate-500">点击左侧任意资料即可按需加载正文。</p>
          </div>
        )}
      </section>
    </div>
  </AppShell>;
}

function LocalRow({ item, busy, selected, onPreview, onToggle }: { item: LocalKnowledgeItem; busy: string | null; selected: boolean; onPreview: () => void; onToggle: () => void }) {
  return <article className="flex items-start gap-3 p-4"><button className="min-w-0 flex-1 text-left" disabled={busy !== null} onClick={onPreview}><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-400">本地 · {item.path}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">{item.excerpt || "空文件"}</span></button><SelectButton selected={selected} onClick={onToggle} /></article>;
}

function RemoteRow({ item, busy, selected, onPreview, onToggle }: { item: FeishuItem | RemoteKnowledgeSource; busy: string | null; selected: boolean; onPreview: () => void; onToggle: () => void }) {
  return <article className="flex items-start gap-3 p-4"><button className="min-w-0 flex-1 text-left" disabled={busy !== null} onClick={onPreview}><span className="block text-[10px] font-semibold text-emerald-700">{item.source === "base" ? "飞书多维表格" : "飞书文档"}</span><span className="mt-1 block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-400">{busy === `preview:${item.id}` ? "读取正文中…" : item.id}</span></button><SelectButton selected={selected} onClick={onToggle} /></article>;
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
