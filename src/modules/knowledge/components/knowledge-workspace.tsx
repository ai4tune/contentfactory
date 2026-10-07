"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/navigation-link";
import { useKnowledgeTasks } from "../tasks/provider";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import {
  applyKnowledgeOrganization,
  chooseKnowledgeDirectory,
  disconnectKnowledgeDirectory,
  KnowledgeDirectoryPermissionError,
  loadLocalKnowledge,
  readLocalKnowledgeItem,
  readLocalKnowledgeItems,
  reconnectKnowledgeDirectory,
  refreshStoredDirectory,
  requestStoredDirectoryPermission,
  searchLocalKnowledge,
  supportsDirectoryPicker,
} from "../local-index";
import { recommendKnowledgeItems } from "../file-classification";
import { MAX_PDF_INDEX_PAGES } from "../document-text";
import type { LocalKnowledgeScanOptions } from "../local-index";
import type { KnowledgeOrganizationPlan } from "../organization";
import type { KnowledgePreview, KnowledgeScanProgress, KnowledgeScanReport, LocalKnowledgeItem, RemoteKnowledgeSource } from "../types";

type FeishuItem = Omit<RemoteKnowledgeSource, "updatedAt"> & { text?: string };

const MAX_AI_SOURCES = 30;

export function KnowledgeWorkspace({ initialOrganizationTaskId }: { initialOrganizationTaskId?: string }) {
  const { tasks, refresh: refreshTasks } = useKnowledgeTasks();
  const [organizationTaskId, setOrganizationTaskId] = useState<string | null>(initialOrganizationTaskId ?? null);
  const [localItems, setLocalItems] = useState<LocalKnowledgeItem[]>([]);
  const [remoteSources, setRemoteSources] = useState<RemoteKnowledgeSource[]>([]);
  const [feishuResults, setFeishuResults] = useState<FeishuItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [permission, setPermission] = useState<PermissionState | "none" | "unsupported">("none");
  const [scanReport, setScanReport] = useState<KnowledgeScanReport | null>(null);
  const [scanProgress, setScanProgress] = useState<KnowledgeScanProgress | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const localResults = useMemo(() => searchLocalKnowledge(localItems, query), [localItems, query]);
  const displayedRemoteResults = query.trim() ? feishuResults : remoteSources;
  const selectedLocalCount = selectedIds.filter((id) => id.startsWith("local:")).length;
  const recommendedLocalItems = useMemo(() => recommendKnowledgeItems(localItems), [localItems]);
  const scanSummary = scanReport ? summarizeKnowledgeScan(scanReport) : null;

  const organizationTask = organizationTaskId !== null
    ? tasks.find((task) => task.id === organizationTaskId)
    : tasks.find((task) => task.kind === "organization" && task.status === "succeeded");
  const organizationPlan = organizationTask?.status === "succeeded" ? organizationTask.plan ?? null : null;

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!supportsDirectoryPicker()) return setPermission("unsupported");
      try {
        const cached = await loadLocalKnowledge();
        const restored = await reconnectKnowledgeDirectory();
        if (!active) return;
        setLocalItems(restored?.items ?? cached);
        setScanReport(restored?.report ?? null);
        setPermission(restored?.permission ?? "none");
      } catch {
        if (active) setMessage("本地索引恢复失败，请重新选择知识库文件夹。");
      }
    }
    void restore();
    void loadRemoteSources().then((sources) => active && setRemoteSources(sources));
    return () => { active = false; scanController.current?.abort(); };
  }, []);

  async function run(key: string, task: (options?: LocalKnowledgeScanOptions) => Promise<void>) {
    const controller = ["choose", "refresh", "grant"].includes(key) ? new AbortController() : null;
    if (controller) {
      scanController.current = controller;
      setScanProgress({ phase: "connecting", checkedFiles: 0, indexedFiles: 0, skippedFiles: 0 });
    }
    setBusy(key);
    setMessage(null);
    try {
      await task(controller ? { signal: controller.signal, onProgress: setScanProgress } : undefined);
    } catch (error) {
      if (error instanceof KnowledgeDirectoryPermissionError) setPermission(error.permission);
      setMessage(controller?.signal.aborted ? "已停止本地索引，原有文件夹连接和索引保持不变。可以选一个较小的文件夹重试。" : error instanceof DOMException && error.name === "AbortError"
        ? "没有选择文件夹，原有连接保持不变。"
        : error instanceof Error ? error.message : "操作失败，请重试。");
    } finally {
      if (controller) { setScanProgress(null); scanController.current = null; }
      setBusy(null);
    }
  }

  async function chooseDirectory() {
    await run("choose", async (options) => {
      const snapshot = await chooseKnowledgeDirectory(options);
      setLocalItems(snapshot.items);
      setScanReport(snapshot.report);
      setOrganizationTaskId("");
      setPermission("granted");
      setMessage(`资料检查完成：找到 ${snapshot.report.readableFiles} 份可直接整理的文字与办公文档。原文件没有被修改。`);
    });
  }

  async function refreshDirectory() {
    await run("refresh", async (options) => {
      const snapshot = await refreshStoredDirectory(options);
      setLocalItems(snapshot.items);
      setScanReport(snapshot.report);
      setOrganizationTaskId("");
      setMessage(`资料已重新检查，共 ${snapshot.items.length} 份文字与办公文档可以直接整理。`);
    });
  }

  async function grantPermission() {
    await run("grant", async (options) => {
      const snapshot = await requestStoredDirectoryPermission(options);
      setLocalItems(snapshot.items);
      setScanReport(snapshot.report);
      setPermission("granted");
      setMessage("文件夹读取权限已恢复，已选资料仍保留。请再次点击生成知识档案或目录整理建议。");
    });
  }

  async function disconnectDirectory() {
    await run("disconnect", async () => {
      await disconnectKnowledgeDirectory();
      setLocalItems([]);
      setScanReport(null);
      setOrganizationTaskId("");
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

  function selectRecommendedSources() {
    const remoteIds = selectedIds.filter((id) => !id.startsWith("local:")).slice(0, MAX_AI_SOURCES);
    const recommendedIds = recommendedLocalItems
      .slice(0, MAX_AI_SOURCES - remoteIds.length)
      .map((item) => item.id);
    setSelectedIds([...remoteIds, ...recommendedIds]);
    setMessage(recommendedIds.length
      ? `已按系统建议选择 ${recommendedIds.length} 份本地资料。请点击“生成知识档案”，也可以在下方逐份调整。已有目录结构无需重新整理。`
      : "当前没有可以新增的文字或办公文档。");
  }

  function reviewLocalSources() {
    document.getElementById("knowledge-file-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function resolveSelectedSources(ids = selectedIds) {
    const remoteById = new Map([...remoteSources, ...feishuResults].map((item) => [item.id, item]));
    const localTexts = new Map((await readLocalKnowledgeItems(ids.filter((id) => id.startsWith("local:"))))
      .map((item) => [item.id, item.text]));
    return Promise.all(ids.map(async (id) => {
      const local = localItems.find((item) => item.id === id);
      if (local) return {
        id: local.id,
        title: local.title,
        source: "local" as const,
        path: local.path,
        text: localTexts.get(local.id)!.slice(0, 12_000),
      };
      if (preview?.id === id && preview.text.trim()) return preview;
      const remote = remoteById.get(id);
      if (!remote) throw new Error(`无法读取已选资料：${id}`);
      const document = remote.source === "base" && remote.url
        ? await fetchFeishu("/api/integrations/feishu/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: remote.url }),
          })
        : await fetchFeishu(`/api/integrations/feishu/documents/${encodeURIComponent(remote.id)}`);
      return { ...document, text: document.text?.slice(0, 12_000) ?? "" };
    }));
  }

  async function createOrganizationPlan() {
    const localIds = selectedIds.filter((id) => id.startsWith("local:"));
    if (!localIds.length) return setMessage("请先选择要整理的本地资料。");
    if (localIds.length > MAX_AI_SOURCES) return setMessage(`每次最多整理 ${MAX_AI_SOURCES} 份资料，请先取消一些选择。`);
    await run("organize-plan", async () => {
      const response = await fetch("/api/knowledge/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "organization", sources: await resolveSelectedSources(localIds) }),
      });
      const payload = await response.json() as { task?: { id: string }; error?: string };
      if (!response.ok || !payload.task) throw new Error(payload.error ?? "整理任务提交失败。");
      setOrganizationTaskId(payload.task.id);
      await refreshTasks();
      setMessage("目录整理任务已提交后台。可以离开或关闭浏览器；方案完成后再核对并确认创建副本。");
    });
  }

  async function confirmOrganization() {
    if (!organizationPlan) return;
    await run("organize-apply", async () => {
      const result = await applyKnowledgeOrganization(organizationPlan);
      setMessage(`已在原文件夹中创建“${result.rootName}”，复制 ${result.copiedFiles} 份资料。原文件没有移动或删除。`);
    });
  }

  async function buildKnowledgeProfile() {
    if (!selectedIds.length) return setMessage("请先选择要整理的知识资料。");
    if (selectedIds.length > MAX_AI_SOURCES) return setMessage(`每次最多生成 ${MAX_AI_SOURCES} 份资料的知识档案，请先取消一些选择。`);
    await run("profile", async () => {
      const sources = await resolveSelectedSources();
      const response = await fetch("/api/knowledge/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "profile", sources }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "企业知识档案整理失败。");
      await refreshTasks();
      setMessage("建档任务已提交后台，可以离开、刷新或关闭浏览器。完成后会在站内提醒，请打开档案核对确认。");
    });
  }

  return <AppShell active="/knowledge">
    <PageHeader eyebrow="CUSTOMER-OWNED KNOWLEDGE" title="知识库" description="已有目录结构可以直接使用，无需重新整理。选择代表性资料 → 生成知识档案 → 人工核对确认，再用于账号定位和创作。" actions={<><Link className={secondaryButtonClass} href="/knowledge/profile">查看企业知识档案</Link><button className={primaryButtonClass} disabled={!selectedIds.length || busy !== null} onClick={buildKnowledgeProfile} type="button">{busy === "profile" ? "读取资料并提交中…" : `生成知识档案（${selectedIds.length}）`}</button></>} />
    <p className="mt-3 text-xs leading-5 text-slate-500">提交成功后可离开页面，后台持续处理并保存进度。所选资料的文字摘要会暂存用于失败重试，完成后清除；原文件不会被修改。</p>
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
              {permission === "granted" ? "已连接" : permission === "prompt" || permission === "denied" ? "等待授权" : "未连接"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">支持 MD、TXT、PDF、Word（DOCX）；PPT、图片和视频暂不读取。PDF 索引检查前 {MAX_PDF_INDEX_PAGES} 页，选中资料用于 AI 建档时再读取正文。</p>
          {permission === "unsupported" ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">请使用桌面版 Chrome 或 Edge。</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={`${primaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={chooseDirectory}>
                {busy === "choose" ? "建立索引中…" : localItems.length ? "更换文件夹" : "选择文件夹"}
              </button>
              {(permission === "prompt" || permission === "denied") ? <button className={`${primaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={grantPermission}>{busy === "grant" ? "恢复中…" : "恢复读取权限"}</button> : null}
              {permission === "granted" ? <button className={`${secondaryButtonClass} min-h-9 px-3 text-xs`} disabled={busy !== null} onClick={refreshDirectory}>刷新</button> : null}
              {localItems.length ? <button className="min-h-9 px-2 text-xs font-semibold text-slate-500 hover:text-slate-800" disabled={busy !== null} onClick={disconnectDirectory}>移除</button> : null}
            </div>
          )}
          {scanProgress ? <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-3 text-xs leading-5" role="status" aria-live="polite">
            <p className="flex items-center gap-2 font-semibold text-emerald-900"><span className="size-3 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-800" aria-hidden="true" />{scanProgress.phase === "connecting" ? "正在核对登录状态并准备索引…" : scanProgress.phase === "saving" ? "正在保存本地索引…" : "正在检查本地资料…"}</p>
            <p className="mt-1 text-slate-600">已发现 {scanProgress.checkedFiles} 个文件 · 已索引 {scanProgress.indexedFiles} 份 · 已跳过 {scanProgress.skippedFiles} 份</p>
            {scanProgress.currentPath ? <p className="mt-1 break-all text-slate-600">{scanProgress.phase === "reading" ? "正在读取：" : "正在检查："}{scanProgress.currentPath}</p> : null}
            <p className="mt-2 text-slate-500">本地索引请保持页面打开。单个文件读取超过 15 秒会跳过并列出原因；AI 建档提交成功后可离开页面。</p>
            {scanProgress.phase !== "saving" ? <button className="mt-2 font-semibold text-emerald-800 underline" type="button" onClick={() => scanController.current?.abort()}>停止索引</button> : null}
          </div> : null}
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
      {scanReport && scanSummary ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-emerald-950">资料检查完成，原文件没有被修改</h3>
          <p className="mt-1 text-xs leading-5 text-emerald-900/75">系统已自动排除常见程序、缓存和系统目录，并把剩余内容按用途分组。你不需要判断文件扩展名。</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-white/85 p-4">
            <div className="flex items-start gap-3"><input aria-label="读取文字与办公文档" checked readOnly type="checkbox" className="mt-0.5 size-4 accent-emerald-800" /><div><p className="text-sm font-semibold text-slate-900">文字与办公文档</p><p className="mt-1 text-xs leading-5 text-slate-500">{scanSummary.readable} 份可直接整理：Markdown、TXT、PDF、Word</p></div></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
            <div className="flex items-start gap-3"><input aria-label="读取图片与扫描件" disabled type="checkbox" className="mt-0.5 size-4" /><div><p className="text-sm font-semibold text-slate-800">图片与无文字摘要的 PDF</p><p className="mt-1 text-xs leading-5 text-slate-500">{scanSummary.imagesAndScans} 份暂不读取；扫描件需先转换成文字，PDF 前 {MAX_PDF_INDEX_PAGES} 页没有文字时也会归入此处</p></div></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-800">已自动忽略</p><p className="mt-1 text-xs leading-5 text-slate-500">{scanSummary.ignored} 份其他文件或无法读取的资料已跳过；常见程序、日志和缓存目录也会自动跳过</p>
          </div>
        </div>
        {scanReport.failedFiles?.length ? <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><summary className="cursor-pointer font-semibold">{scanReport.failedFiles.length} 份资料未能读取，查看原因</summary><ul className="mt-2 space-y-2">{scanReport.failedFiles.map((file) => <li className="break-all" key={file.path}>{file.path}：{file.reason}</li>)}</ul><p className="mt-2">检查文件已下载到电脑、可正常打开后，点击“刷新”重试。</p></details> : null}
        <p className="mt-4 text-xs leading-5 text-slate-600">系统会根据文件名、所在目录和更新时间，先推荐最多 30 份资料作为第一批。{scanReport.emptyFiles ? `另有 ${scanReport.emptyFiles} 份空白文字文件，不会提供有效内容。` : ""}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} disabled={!recommendedLocalItems.length || busy !== null} onClick={selectRecommendedSources} type="button">{`按系统建议选择（${recommendedLocalItems.length}）`}</button>
          <button className={secondaryButtonClass} disabled={!localItems.length} onClick={reviewLocalSources} type="button">查看并调整文件</button>
        </div>
        <details className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">可选：整理文件夹目录</summary>
          <p className="mt-3 text-xs leading-5 text-slate-600">仅在资料散乱、需要分类目录时使用。AI 会读取所选资料并建议目录归类，确认后才创建整理副本，不会移动或删除原文件。这不是生成知识档案的必经步骤；已有结构的知识库可以跳过。</p>
          <button className={`${secondaryButtonClass} mt-3`} disabled={!selectedLocalCount || busy !== null} onClick={createOrganizationPlan} type="button">{busy === "organize-plan" ? "读取资料并提交中…" : `生成目录整理建议（${selectedLocalCount}）`}</button>
        </details>
      </div> : null}
    </section>

    {organizationPlan ? <OrganizationPlanPanel busy={busy} items={localItems} plan={organizationPlan} onConfirm={confirmOrganization} /> : null}

    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <section className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="knowledge-file-list">
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
  return <article className="flex items-start gap-3 p-4"><button className="min-w-0 flex-1 text-left" disabled={busy !== null} onClick={onPreview}><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{item.title}</span><span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{item.extension === "docx" ? "Word" : item.extension}</span></span><span className="mt-1 block truncate text-xs text-slate-400">本地 · {item.path}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">{item.excerpt || "空文件"}</span></button><SelectButton selected={selected} onClick={onToggle} /></article>;
}

function OrganizationPlanPanel({ busy, items, plan, onConfirm }: { busy: string | null; items: LocalKnowledgeItem[]; plan: KnowledgeOrganizationPlan; onConfirm: () => void }) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return <section className="mt-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="text-xs font-semibold tracking-[0.14em] text-amber-700">REVIEW BEFORE COPYING</p><h2 className="mt-2 text-lg font-semibold text-slate-950">确认知识库整理方案</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{plan.summary}</p><p className="mt-2 text-xs text-slate-500">确认后只会在原文件夹中新建“内容工厂-已整理”并复制文件，不移动、不删除原件。</p></div>
      <button className={primaryButtonClass} disabled={busy !== null} onClick={onConfirm} type="button">{busy === "organize-apply" ? "正在创建整理副本…" : "确认并创建整理副本"}</button>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{plan.folders.map((folder) => {
      const assignments = plan.assignments.filter((assignment) => assignment.folderId === folder.id);
      return <div className="rounded-xl bg-slate-50 p-4" key={folder.id}><h3 className="text-sm font-semibold text-slate-900">{folder.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{folder.purpose}</p><ul className="mt-3 grid gap-2">{assignments.length ? assignments.map((assignment) => <li className="text-xs leading-5 text-slate-700" key={assignment.sourceId}><span className="font-semibold">{itemById.get(assignment.sourceId)?.title ?? assignment.sourceId}</span><span className="block text-slate-400">{assignment.reason}</span></li>) : <li className="text-xs text-slate-400">暂无文件</li>}</ul></div>;
    })}</div>
  </section>;
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

function summarizeKnowledgeScan(report: KnowledgeScanReport) {
  const images = report.imageFiles ?? imageCountFromExtensions(report.skippedByExtension);
  const needsOcr = report.needsOcrFiles ?? 0;
  return {
    readable: Math.max(0, report.readableFiles - report.emptyFiles),
    imagesAndScans: images + needsOcr,
    ignored: report.ignoredFiles ?? Math.max(0, report.skippedFiles - images - needsOcr),
  };
}

function imageCountFromExtensions(values: Record<string, number>) {
  const extensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "tif", "tiff", "bmp"]);
  return Object.entries(values).reduce(
    (total, [extension, count]) => total + (extensions.has(extension) ? count : 0),
    0,
  );
}
