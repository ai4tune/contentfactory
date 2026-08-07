"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import {
  downloadXiaohongshuVisualAsset,
  XiaohongshuVisualCard,
} from "@/modules/content/components/xiaohongshu-visual-card";
import { loadLocalKnowledge, readLocalKnowledgeItem } from "@/modules/knowledge/local-index";
import {
  channelLabels,
  contentChannels,
  type ChannelDraft,
  type ContentBrief,
  type ContentChannel,
  type ContentInspirationReference,
  type ContentProject,
  type GeneratedVisualAsset,
} from "@/modules/content/types";
import type { LocalKnowledgeItem } from "@/modules/knowledge/types";
import type { ReviewIssue, ReviewIssueCategory, ReviewRiskLevel } from "@/modules/reviews/types";
import type { TopicSuggestion } from "@/modules/topics/types";
import type { StyleProfile } from "@/modules/style-profile/types";

type KnowledgeSource = {
  id: string;
  title: string;
  url?: string;
  path?: string;
  source: "local" | "feishu" | "base" | "upload";
  text?: string;
};

type CreationMode = "original" | "viral_rewrite";

export function ContentCreationWorkspace({ initialStyleProfile }: { initialStyleProfile: StyleProfile | null }) {
  const [creationMode, setCreationMode] = useState<CreationMode>("original");
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [temporaryStyle, setTemporaryStyle] = useState("");
  const [searchItems, setSearchItems] = useState<KnowledgeSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<KnowledgeSource[]>([]);
  const [inspirations, setInspirations] = useState<ContentInspirationReference[]>([]);
  const [selectedInspirationId, setSelectedInspirationId] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [project, setProject] = useState<ContentProject | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<ContentChannel[]>([...contentChannels]);
  const [activeChannel, setActiveChannel] = useState<ContentChannel>(contentChannels[0]);
  const [generatingChannels, setGeneratingChannels] = useState<ContentChannel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/materials", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { materials?: KnowledgeSource[] }) => payload.materials ?? []),
      fetch("/api/knowledge-sources", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { sources?: KnowledgeSource[] }) => payload.sources ?? []),
      loadLocalKnowledge().then((items) => items.map(localItemToSource)).catch(() => []),
      fetch("/api/inspirations", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { inspirations?: ContentInspirationReference[] }) =>
          payload.inspirations ?? []),
    ])
      .then(([legacy, remote, local, inspirationItems]) => {
        setSearchItems(uniqueSources([...local, ...remote, ...legacy]));
        setInspirations(inspirationItems);
      })
      .catch(() => setMessage("创作资料读取失败，请稍后重试。"));
  }, []);

  const hasKnowledge = selectedSources.length > 0;
  const selectedInspiration = inspirations.find((item) => item.id === selectedInspirationId);
  const canCreateBrief = topic.trim().length > 0
    && (creationMode === "viral_rewrite" ? Boolean(selectedInspiration) : hasKnowledge);

  function changeCreationMode(mode: CreationMode) {
    setCreationMode(mode);
    setSelectedInspirationId("");
    setSuggestions([]);
    setBrief(null);
    setProject(null);
    setMessage(null);
  }

  function selectInspiration(inspiration: ContentInspirationReference) {
    setSelectedInspirationId(inspiration.id);
    if (!topic.trim()) {
      setTopic(inspiration.adaptationIdeas[0] || inspiration.title);
    }
    setSuggestions([]);
    setBrief(null);
    setProject(null);
  }

  function changeTopic(value: string) {
    setTopic(value);
    setBrief(null);
    setProject(null);
  }

  async function searchFeishu() {
    if (!query.trim()) return setMessage("请先输入飞书搜索关键词。");
    await run("search", async () => {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = (await response.json()) as { items?: KnowledgeSource[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "搜索失败");
      setSearchItems(payload.items ?? []);
    });
  }

  async function addKnowledgeSource(source: KnowledgeSource) {
    if (selectedSources.some((item) => item.id === source.id)) return;
    await run(`read:${source.id}`, async () => {
      let selected = source;
      if (source.source === "local") {
        selected = { ...source, text: await readLocalKnowledgeItem(source.id) };
      } else if (!source.text) {
        const response = source.source === "base" && source.url
          ? await fetch("/api/integrations/feishu/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: source.url }),
            })
          : await fetch(`/api/integrations/feishu/documents/${encodeURIComponent(source.id)}`);
        const payload = (await response.json()) as { document?: KnowledgeSource; error?: string };
        if (!response.ok || !payload.document) throw new Error(payload.error ?? "读取文档失败");
        selected = payload.document;
      }
      setSelectedSources((items) => [...items, selected]);
      setSuggestions([]);
      setBrief(null);
      setProject(null);
    });
  }

  async function addFeishuUrl() {
    if (!feishuUrl.trim()) return setMessage("请先粘贴飞书文档或多维表格链接。");
    await run("resolve", async () => {
      const response = await fetch("/api/integrations/feishu/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feishuUrl }),
      });
      const payload = (await response.json()) as { document?: KnowledgeSource; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "读取飞书链接失败");
      setSelectedSources((items) => items.some((item) => item.id === payload.document?.id)
        ? items
        : [...items, payload.document as KnowledgeSource]);
      setFeishuUrl("");
      setSuggestions([]);
      setBrief(null);
      setProject(null);
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    await run("upload", async () => {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = (await response.json()) as { sources?: KnowledgeSource[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "上传失败");
      const sources = payload.sources ?? [];
      setSelectedSources((items) => [...items, ...sources.filter((source) => !items.some((item) => item.id === source.id))]);
      setSearchItems((items) => [...sources, ...items.filter((item) => !sources.some((source) => source.id === item.id))]);
      setSuggestions([]);
      setBrief(null);
      setProject(null);
    });
  }

  async function recommendTopics() {
    if (!hasKnowledge) return setMessage("请先选择至少 1 份知识资料，再推荐选题。");
    await run("suggest", async () => {
      const payload = await postJson<{ suggestions?: TopicSuggestion[]; error?: string }>(
        "/api/topics/suggest",
        { sources: selectedSources, temporaryStyleInstructions: lines(temporaryStyle) },
      );
      setSuggestions(Array.from(
        new Map((payload.suggestions ?? []).map((suggestion) => [suggestion.title, suggestion])).values(),
      ));
    });
  }

  async function generateBrief() {
    if (!canCreateBrief) {
      return setMessage(
        creationMode === "viral_rewrite"
          ? "需要填写选题并选择一篇爆款参考；知识资料可以不选。"
          : "需要填写选题并至少选择 1 份资料。",
      );
    }
    await run("brief", async () => {
      const payload = await postJson<{ brief?: ContentBrief; error?: string }>(
        "/api/content/brief",
        {
          topic,
          sources: selectedSources,
          inspirationId: creationMode === "viral_rewrite" ? selectedInspirationId : undefined,
          temporaryStyleInstructions: lines(temporaryStyle),
        },
      );
      if (!payload.brief) throw new Error("没有生成可用的内容简报。");
      setBrief(payload.brief);
      setProject(null);
    });
  }

  async function confirmBrief() {
    if (!brief) return;
    await run("confirm", async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        "/api/content/projects",
        { topic, brief, temporaryStyleInstructions: lines(temporaryStyle) },
      );
      if (!payload.project) throw new Error("内容项目保存失败。");
      setProject(payload.project);
      setMessage("内容简报已确认并保存，可以进入渠道内容生成。");
    });
  }

  async function generateChannels() {
    if (!project || !selectedChannels.length) return;
    setGeneratingChannels(selectedChannels);
    await run("channels", async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        "/api/content/generate",
        { projectId: project.id, topic, brief: project.brief, channels: selectedChannels, sources: selectedSources },
      );
      if (!payload.project) throw new Error("没有生成可用的渠道草稿。");
      setProject(payload.project);
      const firstGenerated = payload.project.channelDrafts.find((draft) => draft.status === "generated");
      setActiveChannel(firstGenerated?.channel ?? payload.project.channelDrafts[0]?.channel ?? contentChannels[0]);
    });
    setGeneratingChannels([]);
  }

  async function retryChannel(channel: ContentChannel) {
    if (!project) return;
    setGeneratingChannels((items) => [...items, channel]);
    await run(`retry:${channel}`, async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        `/api/content/generate/${channel}`,
        { projectId: project.id, topic, brief: project.brief, channels: [channel], sources: selectedSources },
      );
      if (!payload.project) throw new Error("单渠道重试失败。");
      setProject(payload.project);
      setActiveChannel(channel);
    });
    setGeneratingChannels((items) => items.filter((item) => item !== channel));
  }

  async function saveChannel(channel: ContentChannel, content: string) {
    if (!project) return false;
    return run(`save:${channel}`, async () => {
      const payload = await requestJson<{ project?: ContentProject; error?: string }>(
        `/api/content/projects/${encodeURIComponent(project.id)}/channels/${channel}`,
        { method: "PATCH", body: { content } },
      );
      if (!payload.project) throw new Error("稿件保存失败。");
      setProject(payload.project);
      setMessage(`${channelLabels[channel]}已保存。`);
    });
  }

  async function reviewChannel(channel: ContentChannel) {
    if (!project) return false;
    return run(`review:${channel}`, async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        `/api/content/projects/${encodeURIComponent(project.id)}/channels/${channel}/review`,
        {},
      );
      if (!payload.project) throw new Error("AI 审核没有返回结果。");
      setProject(payload.project);
      setMessage(`${channelLabels[channel]}审核完成。`);
    });
  }

  async function applyIssue(channel: ContentChannel, issueId: string) {
    if (!project) return false;
    return run(`apply:${issueId}`, async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        `/api/content/projects/${encodeURIComponent(project.id)}/channels/${channel}/review/issues/${encodeURIComponent(issueId)}/apply`,
        {},
      );
      if (!payload.project) throw new Error("审核建议应用失败。");
      setProject(payload.project);
      setMessage("建议已应用到稿件，可继续处理或重新审核。");
    });
  }

  async function generateXiaohongshuImages(assetId?: string) {
    if (!project) return false;
    return run(assetId ? `image:${assetId}` : "images", async () => {
      const payload = await postJson<{ project?: ContentProject; error?: string }>(
        `/api/content/projects/${encodeURIComponent(project.id)}/channels/xiaohongshu_note/images`,
        assetId ? { assetId } : {},
      );
      if (!payload.project) throw new Error("没有返回可用的小红书配图。");
      setProject(payload.project);
      setMessage(assetId ? "封面背景已重新生成。" : "小红书封面和正文内页已生成并保存。");
    });
  }

  async function saveXiaohongshuVisualAsset(
    assetId: string,
    input: { title: string; body: string; points: string[] },
  ) {
    if (!project) return false;
    return run(`save-image:${assetId}`, async () => {
      const payload = await requestJson<{ project?: ContentProject; error?: string }>(
        `/api/content/projects/${encodeURIComponent(project.id)}/channels/xiaohongshu_note/images`,
        { method: "PATCH", body: { assetId, ...input } },
      );
      if (!payload.project) throw new Error("图文页保存失败。");
      setProject(payload.project);
      setMessage("图文页文字已保存，预览和下载会使用新内容。");
    });
  }

  function toggleChannel(channel: ContentChannel) {
    setSelectedChannels((channels) => channels.includes(channel)
      ? channels.filter((item) => item !== channel)
      : [...channels, channel]);
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 grid gap-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">创作输入</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">可以从自己的知识出发原创，也可以学习一篇爆款的钩子和结构后重新创作。</p>
        </div>

        <InputSection title="1. 选择创作方式">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              aria-pressed={creationMode === "original"}
              className={`rounded-xl border p-4 text-left transition ${
                creationMode === "original"
                  ? "border-emerald-800 bg-emerald-50"
                  : "border-slate-200 hover:border-emerald-700"
              }`}
              disabled={busy !== null}
              onClick={() => changeCreationMode("original")}
              type="button"
            >
              <span className="block text-sm font-semibold text-slate-900">原创创作</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">根据账号定位和自己的知识资料，生成新的选题与内容。</span>
            </button>
            <button
              aria-pressed={creationMode === "viral_rewrite"}
              className={`rounded-xl border p-4 text-left transition ${
                creationMode === "viral_rewrite"
                  ? "border-emerald-800 bg-emerald-50"
                  : "border-slate-200 hover:border-emerald-700"
              }`}
              disabled={busy !== null}
              onClick={() => changeCreationMode("viral_rewrite")}
              type="button"
            >
              <span className="block text-sm font-semibold text-slate-900">爆款改写</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">学习爆款的受众、钩子和结构，再结合当前账号重新表达。</span>
            </button>
          </div>

          {creationMode === "viral_rewrite" ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">选择一篇爆款参考</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">只学习方法，不把原文数据、案例和产品事实当作自己的内容。</p>
                </div>
                <Link className="shrink-0 text-xs font-semibold text-emerald-800 hover:underline" href="/inspirations/new">＋ 录入爆款</Link>
              </div>
              {inspirations.length ? (
                <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                  {inspirations.map((inspiration) => {
                    const selected = inspiration.id === selectedInspirationId;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`rounded-xl border p-3 text-left ${
                          selected
                            ? "border-emerald-800 bg-emerald-50"
                            : "border-slate-200 hover:border-emerald-700 hover:bg-slate-50"
                        }`}
                        disabled={busy !== null}
                        key={inspiration.id}
                        onClick={() => selectInspiration(inspiration)}
                        type="button"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{inspiration.platform}</span>
                          {inspiration.metrics ? <span className="text-[10px] text-slate-400">{inspiration.metrics}</span> : null}
                        </span>
                        <span className="mt-2 block text-xs font-semibold leading-5 text-slate-800">{inspiration.title}</span>
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-slate-500">{inspiration.summary}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-500">爆款库还是空的。先录入一篇标题、正文和来源链接，AI 拆解后即可在这里选择。</p>
              )}

              {selectedInspiration ? (
                <div className="mt-3 rounded-xl bg-[#173e32] p-4 text-white">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-amber-300">本次改写依据</p>
                  <p className="mt-2 text-xs font-semibold leading-5">{selectedInspiration.title}</p>
                  <p className="mt-3 text-[11px] leading-5 text-white/70">钩子：{selectedInspiration.hook || "待结合选题确定"}</p>
                  {selectedInspiration.reusablePatterns.length ? (
                    <ul className="mt-2 space-y-1 text-[11px] leading-5 text-white/70">
                      {selectedInspiration.reusablePatterns.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </InputSection>

        <InputSection
          title={`2. 选择本次知识${creationMode === "viral_rewrite" ? "（可选）" : ""}`}
          meta={`${selectedSources.length} 份已选`}
        >
          <div className="grid gap-3">
            <div className="flex gap-2">
              <input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-800" disabled={busy !== null} onChange={(event) => setQuery(event.target.value)} placeholder="搜索飞书知识" value={query} />
              <button className={secondaryButtonClass} disabled={busy !== null} onClick={searchFeishu} type="button">{busy === "search" ? "搜索中" : "搜索"}</button>
            </div>
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">其他添加方式</summary>
              <div className="mt-3 grid gap-3">
                <div className="flex gap-2">
                  <input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none" disabled={busy !== null} onChange={(event) => setFeishuUrl(event.target.value)} placeholder="飞书文档链接" value={feishuUrl} />
                  <button className={secondaryButtonClass} disabled={busy !== null} onClick={addFeishuUrl} type="button">读取</button>
                </div>
                <label className="flex cursor-pointer justify-between rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-medium text-slate-600">
                  <span>{busy === "upload" ? "正在读取文件" : "兼容入口：上传 TXT / MD / CSV"}</span><span>选择</span>
                  <input accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" className="sr-only" disabled={busy !== null} multiple onChange={(event) => uploadFiles(event.target.files)} type="file" />
                </label>
              </div>
            </details>

            {searchItems.length ? (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                {searchItems.slice(0, 12).map((item) => {
                  const selected = selectedSources.some((source) => source.id === item.id);
                  return <button className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 disabled:bg-emerald-50/50" disabled={selected || busy !== null} key={item.id} onClick={() => addKnowledgeSource(item)} type="button">
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-700">{item.title}</span><span className="text-[11px] text-slate-400">{sourceLabel(item.source)}</span></span>
                    <span className="shrink-0 text-xs font-semibold text-emerald-800">{selected ? "已选" : busy === `read:${item.id}` ? "读取中" : "选择"}</span>
                  </button>;
                })}
              </div>
            ) : <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">暂无资料。可先去知识库连接本地文件夹，或搜索飞书。</p>}

            {selectedSources.map((source) => (
              <div className="rounded-xl bg-[#e9f0ec] px-3 py-3" key={source.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{source.title}</p><p className="text-[11px] text-slate-500">{sourceLabel(source.source)}</p></div>
                  <button className="text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy !== null} onClick={() => { setSelectedSources((items) => items.filter((item) => item.id !== source.id)); setSuggestions([]); setBrief(null); setProject(null); }} type="button">移除</button>
                </div>
                {source.text ? <details className="mt-2 border-t border-emerald-900/10 pt-2"><summary className="cursor-pointer text-[11px] font-semibold text-emerald-800">预览资料</summary><MarkdownPreview className="mt-2 max-h-52 overflow-y-auto rounded-lg bg-white/75 p-3" content={source.text} /></details> : null}
              </div>
            ))}
          </div>
        </InputSection>

        <InputSection title="3. 确定选题">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">这次想写什么</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {creationMode === "viral_rewrite"
                  ? "可以填写自己的标题，或直接使用下方基于爆款拆解得到的改写方向。"
                  : "可以直接填写预期标题；如果还没想好，让 AI 结合账号定位和已选资料推荐。"}
              </p>
            </div>
            {creationMode === "original" ? (
              <button
                className={`${secondaryButtonClass} shrink-0`}
                disabled={!hasKnowledge || busy !== null}
                onClick={recommendTopics}
                type="button"
              >
                {busy === "suggest" ? "正在推荐" : suggestions.length ? "再来一批" : "推荐一批"}
              </button>
            ) : null}
          </div>
          <textarea
            aria-label="这次想写什么"
            className="mt-3 min-h-24 w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
            disabled={busy !== null}
            onChange={(event) => changeTopic(event.target.value)}
            placeholder={creationMode === "viral_rewrite"
              ? "输入预期标题，也可以选择下方的改写方向"
              : "输入预期标题，也可以先留空并点击“推荐一批”"}
            value={topic}
          />
          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">本次临时风格（可选）</summary>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {initialStyleProfile
                ? `默认使用“${initialStyleProfile.name}” v${initialStyleProfile.version}。这里的要求只影响本次内容，不会改写默认风格。`
                : "当前还没有确认写作风格。可以先填写本次要求，之后再到当前账号建立默认风格。"}
            </p>
            <textarea
              className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-emerald-800"
              disabled={busy !== null || Boolean(project)}
              onChange={(event) => { setTemporaryStyle(event.target.value); setBrief(null); setProject(null); }}
              placeholder="例如：这次更像一段真实复盘；少用行业术语；开头先讲我踩过的坑。每行一项。"
              value={temporaryStyle}
            />
            {!initialStyleProfile ? <Link className="mt-2 inline-block text-xs font-semibold text-emerald-800 hover:underline" href="/style-profile">建立默认写作风格</Link> : null}
          </details>
          {!hasKnowledge ? (
            <p className="mt-2 text-xs text-slate-400">
              {creationMode === "viral_rewrite"
                ? "不选知识资料也可以改写；如果涉及自己的产品、案例或观点，建议先选择资料。"
                : "先选择至少 1 份知识资料，才能获得针对性的题目推荐。"}
            </p>
          ) : null}
          {creationMode === "viral_rewrite" && selectedInspiration?.adaptationIdeas.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {selectedInspiration.adaptationIdeas.slice(0, 6).map((idea) => (
                <button
                  className={`rounded-xl border p-3 text-left text-xs font-semibold leading-5 transition ${
                    topic === idea
                      ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 text-slate-700 hover:border-emerald-700 hover:bg-emerald-50/50"
                  }`}
                  disabled={busy !== null}
                  key={idea}
                  onClick={() => changeTopic(idea)}
                  type="button"
                >
                  {idea}
                </button>
              ))}
            </div>
          ) : null}
          {suggestions.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    topic === suggestion.title
                      ? "border-emerald-800 bg-emerald-50"
                      : "border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/50"
                  }`}
                  disabled={busy !== null}
                  key={suggestion.title}
                  onClick={() => changeTopic(suggestion.title)}
                  type="button"
                >
                  <span className="block text-xs font-semibold text-slate-800">{suggestion.title}</span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">写作角度：{suggestion.angle}</span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">推荐理由：{suggestion.rationale}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button className={`${primaryButtonClass} w-full`} disabled={!canCreateBrief || busy !== null} onClick={generateBrief} type="button">
              {busy === "brief" ? "AI 正在生成内容简报" : brief ? "重新生成内容简报" : "生成内容简报"}
            </button>
            {!canCreateBrief ? (
              <p className="mt-2 text-center text-[11px] text-slate-400">
                {creationMode === "viral_rewrite"
                  ? "填写选题并选择一篇爆款参考后可生成；知识资料为可选。"
                  : "填写选题并选择至少 1 份资料后可生成。"}
              </p>
            ) : null}
          </div>
        </InputSection>
      </div>

      {message ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900" role="status">{message}</p> : null}

      {busy === "brief" || brief ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div><h2 className="text-base font-semibold text-slate-950">统一内容简报</h2><p className="mt-1 text-xs text-slate-500">确认后，后续所有渠道都以这份简报为准</p></div>
            {project ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">已确认</span> : brief ? <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">待确认</span> : null}
          </div>
          {busy === "brief" ? <BriefSkeleton /> : brief ? (
            <div className="grid gap-5 p-5 sm:p-6">
            <fieldset className="grid gap-5" disabled={Boolean(project) || busy === "confirm"}>
            <BriefField label="目标受众" value={brief.targetAudience} onChange={(value) => updateBrief(setBrief, "targetAudience", value)} />
            <BriefField label="内容目标" value={brief.contentGoal} onChange={(value) => updateBrief(setBrief, "contentGoal", value)} />
            <BriefField label="核心观点" value={brief.coreMessage} onChange={(value) => updateBrief(setBrief, "coreMessage", value)} multiline />
            <BriefListField label="关键论点" value={brief.keyPoints} onChange={(value) => updateBrief(setBrief, "keyPoints", value)} />
            <BriefListField label="内容结构" value={brief.outline} onChange={(value) => updateBrief(setBrief, "outline", value)} />
            <BriefField label="行动引导" value={brief.callToAction} onChange={(value) => updateBrief(setBrief, "callToAction", value)} />
            {brief.inspiration ? <BriefInspiration inspiration={brief.inspiration} /> : null}
            <div>
              <h3 className="text-xs font-semibold text-slate-700">知识引用</h3>
              {brief.citations.length ? (
                <div className="mt-2 grid gap-2">
                  {brief.citations.map((citation) => <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={`${citation.sourceId}:${citation.excerpt}`}><p className="text-xs font-semibold text-slate-800">{citation.sourceTitle} <span className="font-normal text-slate-400">· {citation.sourceId}</span></p><MarkdownPreview className="mt-2 rounded-lg bg-white p-3" content={citation.excerpt} /><input className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs" onChange={(event) => setBrief((current) => current ? { ...current, citations: current.citations.map((item) => item === citation ? { ...item, purpose: event.target.value } : item) } : current)} value={citation.purpose} /></div>)}
                </div>
              ) : <p className="mt-2 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">本次没有选择知识资料。爆款只作为结构参考，涉及事实、案例和数据的内容需要人工确认。</p>}
            </div>
            <BriefListField label="待确认信息" value={brief.openQuestions} onChange={(value) => updateBrief(setBrief, "openQuestions", value)} />
            <div className="border-t border-slate-200 pt-5">
              <button className={`${primaryButtonClass} w-full`} disabled={Boolean(project) || busy === "confirm"} onClick={confirmBrief} type="button">{busy === "confirm" ? "正在原子保存" : project ? `已保存项目 ${project.id}` : "确认简报并创建内容项目"}</button>
            </div>
            </fieldset>
            {project ? (
              <ChannelGenerationPanel
                activeChannel={activeChannel}
                busy={busy}
                drafts={project.channelDrafts}
                generatingChannels={generatingChannels}
                onApplyIssue={applyIssue}
                onGenerate={generateChannels}
                onGenerateImages={generateXiaohongshuImages}
                onSaveVisualAsset={saveXiaohongshuVisualAsset}
                onReview={reviewChannel}
                onRetry={retryChannel}
                onSave={saveChannel}
                onSelect={setActiveChannel}
                onToggle={toggleChannel}
                projectId={project.id}
                accountName={project.accountSnapshot?.accountName}
                selectedChannels={selectedChannels}
                topic={project.topic}
              />
            ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChannelGenerationPanel({
  accountName,
  activeChannel,
  busy,
  drafts,
  generatingChannels,
  onApplyIssue,
  onGenerate,
  onGenerateImages,
  onSaveVisualAsset,
  onReview,
  onRetry,
  onSave,
  onSelect,
  onToggle,
  projectId,
  selectedChannels,
  topic,
}: {
  accountName?: string;
  activeChannel: ContentChannel;
  busy: string | null;
  drafts: ChannelDraft[];
  generatingChannels: ContentChannel[];
  onApplyIssue: (channel: ContentChannel, issueId: string) => Promise<boolean>;
  onGenerate: () => void;
  onGenerateImages: (assetId?: string) => Promise<boolean>;
  onSaveVisualAsset: (
    assetId: string,
    input: { title: string; body: string; points: string[] },
  ) => Promise<boolean>;
  onReview: (channel: ContentChannel) => Promise<boolean>;
  onRetry: (channel: ContentChannel) => void;
  onSave: (channel: ContentChannel, content: string) => Promise<boolean>;
  onSelect: (channel: ContentChannel) => void;
  onToggle: (channel: ContentChannel) => void;
  projectId: string;
  selectedChannels: ContentChannel[];
  topic: string;
}) {
  const [editorContents, setEditorContents] = useState<Partial<Record<ContentChannel, string>>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const activeDraft = drafts.find((draft) => draft.channel === activeChannel) ?? drafts[0];
  const generating = generatingChannels.length > 0;
  const locked = busy !== null || generating;
  const editorContent = activeDraft
    ? editorContents[activeDraft.channel] ?? activeDraft.content
    : "";
  const dirty = Boolean(activeDraft && editorContent !== activeDraft.content);
  const imageBusy = busy === "images" || Boolean(busy?.startsWith("image:"));
  const hasUnsavedEdits = drafts.some((draft) => {
    const editedContent = editorContents[draft.channel];
    return editedContent !== undefined && editedContent !== draft.content;
  });

  function clearEditorOverride(channel: ContentChannel) {
    setEditorContents((current) => {
      const next = { ...current };
      delete next[channel];
      return next;
    });
  }

  async function saveActiveDraft() {
    if (!activeDraft) return;
    if (await onSave(activeDraft.channel, editorContent)) {
      clearEditorOverride(activeDraft.channel);
      setActionNotice("修改已保存");
    }
  }

  async function applyActiveIssue(issue: ReviewIssue) {
    if (!activeDraft) return;
    if (await onApplyIssue(activeDraft.channel, issue.id)) {
      clearEditorOverride(activeDraft.channel);
      setActionNotice("建议已应用");
    }
  }

  async function copyActiveDraft() {
    if (!editorContent) return;
    try {
      await navigator.clipboard.writeText(editorContent);
      setActionNotice("已复制当前渠道内容");
    } catch {
      setActionNotice("复制失败，请在编辑框中手动复制");
    }
  }

  function downloadActiveDraft() {
    if (!activeDraft || !editorContent) return;
    const markdown = `# ${topic}\n\n## ${channelLabels[activeDraft.channel]}\n\n${editorContent}\n`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(topic)}-${channelLabels[activeDraft.channel]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setActionNotice("Markdown 已下载");
  }

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">生成渠道内容</h3>
          <p className="mt-1 text-xs text-slate-500">四套独立 Prompt，共享上方已确认的事实简报。</p>
        </div>
        <button className="shrink-0 text-xs font-semibold text-emerald-800 disabled:text-slate-400" disabled={locked} onClick={() => contentChannels.forEach((channel) => {
          if (!selectedChannels.includes(channel)) onToggle(channel);
        })} type="button">全选</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {contentChannels.map((channel) => {
          const selected = selectedChannels.includes(channel);
          return (
            <button
              aria-pressed={selected}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${selected ? "border-emerald-800 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-500"}`}
              disabled={locked}
              key={channel}
              onClick={() => onToggle(channel)}
              type="button"
            >
              {selected ? "✓ " : "○ "}{channelLabels[channel]}
            </button>
          );
        })}
      </div>

      <button className={`${primaryButtonClass} mt-3 w-full`} disabled={!selectedChannels.length || locked || hasUnsavedEdits} onClick={onGenerate} type="button">
        {generating ? `AI 正在生成 ${generatingChannels.length} 个渠道` : selectedChannels.length === contentChannels.length ? "全部生成" : `生成 ${selectedChannels.length} 个渠道`}
      </button>

      {generating && !drafts.length ? (
        <div className="mt-4 grid gap-2" aria-live="polite">
          {generatingChannels.map((channel) => <div className="animate-pulse rounded-xl bg-slate-100 px-3 py-4 text-xs text-slate-500" key={channel}>{channelLabels[channel]} · 生成中</div>)}
        </div>
      ) : null}

      {drafts.length ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2">
            {drafts.map((draft) => (
              <button className={`shrink-0 rounded-lg px-2.5 py-2 text-[11px] font-semibold ${draft.channel === activeDraft?.channel ? "bg-emerald-900 text-white" : draft.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`} key={draft.channel} onClick={() => onSelect(draft.channel)} type="button">
                {channelLabels[draft.channel]} · {draft.status === "failed" ? "失败" : "已生成"}
              </button>
            ))}
          </div>
          {activeDraft ? (
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-800">{channelLabels[activeDraft.channel]}</p>
                <button className="text-xs font-semibold text-emerald-800 disabled:text-slate-400" disabled={locked || dirty} onClick={() => { clearEditorOverride(activeDraft.channel); onRetry(activeDraft.channel); }} type="button">
                  {dirty ? "先保存修改" : generatingChannels.includes(activeDraft.channel) ? "重试中" : generating ? "生成中" : "单独重试"}
                </button>
              </div>
              {activeDraft.status === "failed"
                ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">{activeDraft.error || "未知错误"}</p>
                : (
                  <div className="mt-3 grid gap-4">
                    <label className="grid gap-2">
                      <span className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>人工编辑稿</span>
                        <span className={dirty ? "text-amber-700" : "text-slate-400"}>{dirty ? "有未保存修改" : "已保存"}</span>
                      </span>
                      <textarea
                        className="min-h-96 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10 disabled:bg-slate-50"
                        disabled={locked}
                        onChange={(event) => {
                          setEditorContents((current) => ({ ...current, [activeDraft.channel]: event.target.value }));
                          setActionNotice(null);
                        }}
                        value={editorContent}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button className={primaryButtonClass} disabled={!dirty || locked || !editorContent.trim()} onClick={saveActiveDraft} type="button">
                        {busy === `save:${activeDraft.channel}` ? "保存中" : "保存修改"}
                      </button>
                      <button className={secondaryButtonClass} disabled={dirty || locked} onClick={() => onReview(activeDraft.channel)} type="button">
                        {busy === `review:${activeDraft.channel}` ? "审核中" : activeDraft.review ? "重新审核" : "AI 审核"}
                      </button>
                      <button className={secondaryButtonClass} disabled={!editorContent} onClick={copyActiveDraft} type="button">复制</button>
                      <button className={secondaryButtonClass} disabled={!editorContent} onClick={downloadActiveDraft} type="button">下载 Markdown</button>
                    </div>
                    {actionNotice ? <p className="text-xs text-emerald-800" role="status">{actionNotice}</p> : null}

                    {activeDraft.channel === "xiaohongshu_note" ? (
                      <XiaohongshuVisuals
                        accountName={accountName}
                        assets={activeDraft.visualAssets ?? []}
                        busy={busy}
                        dirty={dirty}
                        imageBusy={imageBusy}
                        onGenerate={onGenerateImages}
                        onSave={onSaveVisualAsset}
                        projectId={projectId}
                      />
                    ) : null}

                    <ReviewResult
                      busy={busy}
                      dirty={dirty}
                      draft={activeDraft}
                      onApply={applyActiveIssue}
                    />
                  </div>
                )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function XiaohongshuVisuals({
  accountName,
  assets,
  busy,
  dirty,
  imageBusy,
  onGenerate,
  onSave,
  projectId,
}: {
  accountName?: string;
  assets: GeneratedVisualAsset[];
  busy: string | null;
  dirty: boolean;
  imageBusy: boolean;
  onGenerate: (assetId?: string) => Promise<boolean>;
  onSave: (
    assetId: string,
    input: { title: string; body: string; points: string[] },
  ) => Promise<boolean>;
  projectId: string;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function downloadAsset(asset: GeneratedVisualAsset, index: number) {
    setDownloading(asset.id);
    setNotice(null);
    try {
      await downloadXiaohongshuVisualAsset({
        asset,
        brandName: accountName,
        index,
        projectId,
        total: assets.length,
      });
      setNotice(`第 ${index + 1} 张 PNG 已下载。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "图片下载失败。");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">小红书图文故事板</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            首图负责吸引点击；3–6 张正文内页负责解释观点、步骤和清单，文字可继续编辑。
          </p>
        </div>
        <button
          className={assets.length ? secondaryButtonClass : primaryButtonClass}
          disabled={dirty || busy !== null}
          onClick={() => onGenerate()}
          type="button"
        >
          {imageBusy
            ? "AI 正在生成图片"
            : dirty
              ? "先保存文案"
              : assets.length
                ? "整组重新生成"
                : "生成封面和正文内页"}
        </button>
      </div>

      {imageBusy ? (
        <div className="p-4" aria-live="polite">
          <div className="animate-pulse rounded-xl bg-white px-4 py-5 text-xs leading-5 text-slate-500">
            正在拆分正文故事板，并为首图生成无文字背景。只有封面调用生图服务，通常约 1 分钟。
          </div>
        </div>
      ) : assets.length ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {assets.map((asset, index) => (
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white" key={asset.id}>
              <XiaohongshuVisualCard
                asset={asset}
                brandName={accountName}
                index={index}
                total={assets.length}
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      {asset.kind === "cover" ? "点击封面" : `正文内页 ${index}`}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-800">{asset.title}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold ${asset.status === "generated" ? "text-emerald-700" : "text-red-600"}`}>
                    {asset.status === "generated" ? "已生成" : "失败"}
                  </span>
                </div>
                <VisualAssetEditor
                  asset={asset}
                  busy={busy}
                  key={`${asset.id}:${asset.updatedAt}`}
                  onSave={onSave}
                />
                <div className={`mt-3 grid gap-2 ${asset.kind === "cover" ? "grid-cols-2" : "grid-cols-1"}`}>
                  {asset.kind === "cover" ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={busy !== null}
                      onClick={() => onGenerate(asset.id)}
                      type="button"
                    >
                      {busy === `image:${asset.id}` ? "生成中" : "重生成背景"}
                    </button>
                  ) : null}
                  {asset.status === "generated" ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={downloading !== null}
                      onClick={() => downloadAsset(asset, index)}
                      type="button"
                    >
                      {downloading === asset.id ? "正在导出 PNG" : "下载 PNG"}
                    </button>
                  ) : <span />}
                </div>
              </div>
            </article>
          ))}
          {notice ? <p className="text-xs text-emerald-800 sm:col-span-2" role="status">{notice}</p> : null}
        </div>
      ) : (
        <p className="p-4 text-xs leading-5 text-slate-500">
          先确认并保存小红书文案，再让 AI 把终稿拆成一张点击封面和连续正文内页。
        </p>
      )}
    </section>
  );
}

function VisualAssetEditor({
  asset,
  busy,
  onSave,
}: {
  asset: GeneratedVisualAsset;
  busy: string | null;
  onSave: (
    assetId: string,
    input: { title: string; body: string; points: string[] },
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(asset.title);
  const [body, setBody] = useState(asset.body ?? "");
  const [points, setPoints] = useState((asset.points ?? []).join("\n"));
  const dirty = title !== asset.title
    || body !== (asset.body ?? "")
    || points !== (asset.points ?? []).join("\n");

  async function save() {
    await onSave(asset.id, {
      title,
      body,
      points: points.split("\n").map((item) => item.trim()).filter(Boolean),
    });
  }

  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">编辑本页文字</summary>
      <div className="mt-3 grid gap-2">
        <label className="grid gap-1 text-[10px] font-semibold text-slate-500">
          标题
          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-800"
            disabled={busy !== null}
            maxLength={asset.kind === "cover" ? 28 : 32}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-slate-500">
          {asset.kind === "cover" ? "副标题" : "正文解释"}
          <textarea
            className="min-h-20 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal leading-5 text-slate-800"
            disabled={busy !== null}
            maxLength={asset.kind === "cover" ? 60 : 180}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </label>
        {asset.kind === "card" ? (
          <label className="grid gap-1 text-[10px] font-semibold text-slate-500">
            要点（每行一条，最多 5 条）
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal leading-5 text-slate-800"
              disabled={busy !== null}
              onChange={(event) => setPoints(event.target.value)}
              value={points}
            />
          </label>
        ) : null}
        <button
          className={primaryButtonClass}
          disabled={!dirty || !title.trim() || busy !== null}
          onClick={save}
          type="button"
        >
          {busy === `save-image:${asset.id}` ? "保存中" : "保存本页文字"}
        </button>
      </div>
    </details>
  );
}

function ReviewResult({
  busy,
  dirty,
  draft,
  onApply,
}: {
  busy: string | null;
  dirty: boolean;
  draft: ChannelDraft;
  onApply: (issue: ReviewIssue) => void;
}) {
  const review = draft.review;
  if (!review) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-700">待 AI 审核</p><p className="mt-1 text-xs leading-5 text-slate-500">保存人工修改后，独立检查事实、账号风格和平台风险。</p></div>;
  }

  const stale = review.reviewedContent !== draft.content;
  const openIssues = review.issues.filter((issue) => issue.status === "open");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">AI 审核结果</h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskClass(review.riskLevel)}`}>{riskLabel(review.riskLevel)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{review.conclusion}</p>
        </div>
        <span className={`text-[11px] font-semibold ${stale || dirty ? "text-amber-700" : "text-emerald-800"}`}>
          {dirty ? "请先保存再复核" : stale ? "内容已修改，需重新审核" : `${openIssues.length} 项待处理`}
        </span>
      </div>

      {review.issues.length ? (
        <div className="divide-y divide-slate-100">
          {review.issues.map((issue) => (
            <article className={issue.status === "applied" ? "bg-emerald-50/40 p-4" : "p-4"} key={issue.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{reviewCategoryLabel(issue.category)}</span>
                <span className={`text-[10px] font-semibold ${riskTextClass(issue.severity)}`}>{riskLabel(issue.severity)}</span>
                {issue.requiresConfirmation ? <span className="text-[10px] font-semibold text-amber-700">需人工确认</span> : null}
                {issue.status === "applied" ? <span className="text-[10px] font-semibold text-emerald-800">已应用</span> : null}
              </div>
              <h5 className="mt-2 text-xs font-semibold text-slate-800">{issue.title}</h5>
              <p className="mt-1 text-xs leading-5 text-slate-600">{issue.description}</p>
              {issue.originalText ? <blockquote className="mt-2 rounded-lg border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">原文：{issue.originalText}</blockquote> : null}
              {issue.suggestedText ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">建议：{issue.suggestedText}</p> : null}
              {issue.autoFixable && issue.status === "open" ? (
                <button
                  className={`${secondaryButtonClass} mt-3`}
                  disabled={busy !== null || dirty || stale}
                  onClick={() => onApply(issue)}
                  type="button"
                >
                  {busy === `apply:${issue.id}` ? "应用中" : "应用这条建议"}
                </button>
              ) : issue.status === "open" ? <p className="mt-2 text-[11px] text-slate-400">请在上方编辑框中人工调整。</p> : null}
            </article>
          ))}
        </div>
      ) : <p className="p-4 text-xs leading-5 text-emerald-800">未发现需要修改的问题，可以进入人工确认。</p>}
    </section>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, { method: "POST", body });
}

async function requestJson<T>(
  url: string,
  options: { method: "POST" | "PATCH"; body: unknown },
): Promise<T> {
  const response = await fetch(url, {
    method: options.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "请求失败");
  return payload;
}

function localItemToSource(item: LocalKnowledgeItem): KnowledgeSource {
  return { id: item.id, title: item.title, path: item.path, source: "local" };
}

function uniqueSources(sources: KnowledgeSource[]) {
  return [...new Map(sources.map((source) => [`${source.source}:${source.id}`, source])).values()];
}

function updateBrief<K extends keyof ContentBrief>(setBrief: React.Dispatch<React.SetStateAction<ContentBrief | null>>, key: K, value: ContentBrief[K]) {
  setBrief((current) => current ? { ...current, [key]: value } : current);
}

function BriefInspiration({ inspiration }: { inspiration: ContentInspirationReference }) {
  return (
    <section className="rounded-xl border border-emerald-900/15 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-emerald-800">爆款结构参考</p>
          <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-900">{inspiration.title}</h3>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-emerald-800">{inspiration.platform}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">钩子机制：{inspiration.hook || "待结合选题确定"}</p>
      {inspiration.structure.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-700">参考结构</p>
          <ol className="mt-1 space-y-1 text-[11px] leading-5 text-slate-600">
            {inspiration.structure.slice(0, 6).map((item, index) => <li key={`${index}:${item}`}>{index + 1}. {item}</li>)}
          </ol>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-amber-800">仅用于学习钩子、结构和节奏，不作为事实、案例或数据来源。</p>
    </section>
  );
}

function BriefField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="grid gap-2 text-xs font-semibold text-slate-700"><span>{label}</span>{multiline ? <textarea className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6" onChange={(event) => onChange(event.target.value)} value={value} /> : <input className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" onChange={(event) => onChange(event.target.value)} value={value} />}</label>;
}

function BriefListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="grid gap-2 text-xs font-semibold text-slate-700"><span>{label} <span className="font-normal text-slate-400">（每行一项）</span></span><textarea className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6" onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} value={value.join("\n")} /></label>;
}

function MarkdownPreview({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.split("\n");
  return (
    <div className={`text-xs leading-5 text-slate-600 ${className}`}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div className="h-2" key={`space:${index}`} />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) return <p className={`${heading[1].length === 1 ? "text-sm" : "text-xs"} mt-2 font-semibold text-slate-900 first:mt-0`} key={`heading:${index}`}>{cleanMarkdownText(heading[2])}</p>;
        const listItem = line.match(/^[-*+]\s+(.+)$/) ?? line.match(/^\d+[.)、]\s*(.+)$/);
        if (listItem) return <div className="flex gap-2" key={`list:${index}`}><span className="text-emerald-700">•</span><span>{cleanMarkdownText(listItem[1])}</span></div>;
        if (line.startsWith(">")) return <blockquote className="border-l-2 border-emerald-700/30 pl-3 text-slate-500" key={`quote:${index}`}>{cleanMarkdownText(line.slice(1))}</blockquote>;
        return <p key={`text:${index}`}>{cleanMarkdownText(line)}</p>;
      })}
    </div>
  );
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .trim();
}

function BriefSkeleton() {
  return <div className="grid gap-5 p-6" aria-live="polite"><div className="h-10 animate-pulse rounded-xl bg-slate-100" /><div className="h-10 animate-pulse rounded-xl bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-48 animate-pulse rounded-xl bg-slate-100" /></div>;
}

function InputSection({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return <div className="border-b border-slate-100 px-5 py-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{meta ? <span className="text-xs text-slate-400">{meta}</span> : null}</div>{children}</div>;
}

function sourceLabel(source: KnowledgeSource["source"]) {
  return { local: "本地文件夹", feishu: "飞书文档", base: "飞书多维表格", upload: "兼容上传" }[source];
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function reviewCategoryLabel(category: ReviewIssueCategory) {
  return { fact: "事实", style: "风格", platform: "平台" }[category];
}

function riskLabel(risk: ReviewRiskLevel) {
  return { low: "低风险", medium: "中风险", high: "高风险", blocked: "禁止发布" }[risk];
}

function riskClass(risk: ReviewRiskLevel) {
  return {
    low: "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    blocked: "bg-red-100 text-red-800",
  }[risk];
}

function riskTextClass(risk: ReviewRiskLevel) {
  return {
    low: "text-emerald-700",
    medium: "text-amber-700",
    high: "text-orange-700",
    blocked: "text-red-700",
  }[risk];
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "内容稿件";
}
