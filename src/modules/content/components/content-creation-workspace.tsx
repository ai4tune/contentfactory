"use client";

import { useEffect, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { loadLocalKnowledge, readLocalKnowledgeItem } from "@/modules/knowledge/local-index";
import {
  channelLabels,
  contentChannels,
  type ChannelDraft,
  type ContentBrief,
  type ContentChannel,
  type ContentProject,
} from "@/modules/content/types";
import type { LocalKnowledgeItem } from "@/modules/knowledge/types";
import type { TopicSuggestion } from "@/modules/topics/types";

type KnowledgeSource = {
  id: string;
  title: string;
  url?: string;
  path?: string;
  source: "local" | "feishu" | "base" | "upload";
  text?: string;
};

export function ContentCreationWorkspace() {
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [searchItems, setSearchItems] = useState<KnowledgeSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<KnowledgeSource[]>([]);
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
    ])
      .then(([legacy, remote, local]) => setSearchItems(uniqueSources([...local, ...remote, ...legacy])))
      .catch(() => setMessage("知识资料读取失败，请稍后重试。"));
  }, []);

  const hasKnowledge = selectedSources.length > 0;
  const canCreateBrief = topic.trim().length > 0 && hasKnowledge;

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
        { sources: selectedSources },
      );
      setSuggestions(payload.suggestions ?? []);
    });
  }

  async function generateBrief() {
    if (!canCreateBrief) return setMessage("需要填写选题并至少选择 1 份资料。");
    await run("brief", async () => {
      const payload = await postJson<{ brief?: ContentBrief; error?: string }>(
        "/api/content/brief",
        { topic, sources: selectedSources },
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
        { topic, brief },
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 grid items-start gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">创作输入</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">先确定选题和事实依据，再生成统一内容简报。</p>
        </div>

        <InputSection title="确定选题">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <span>这次想写什么</span>
            <textarea
              className="min-h-24 resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
              disabled={busy !== null}
              onChange={(event) => changeTopic(event.target.value)}
              placeholder="例如：装修选地板时，怎么避免只看价格的误区？"
              value={topic}
            />
          </label>
          <button className={`${secondaryButtonClass} mt-3 w-full`} disabled={!hasKnowledge || busy !== null} onClick={recommendTopics} type="button">
            {busy === "suggest" ? "正在结合账号与知识推荐" : "根据账号与已选知识推荐"}
          </button>
          {suggestions.length ? (
            <div className="mt-3 grid gap-2">
              {suggestions.map((suggestion) => (
                <button className="rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-700 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy !== null} key={suggestion.title} onClick={() => changeTopic(suggestion.title)} type="button">
                  <span className="block text-xs font-semibold text-slate-800">{suggestion.title}</span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">{suggestion.angle} · {suggestion.rationale}</span>
                </button>
              ))}
            </div>
          ) : null}
        </InputSection>

        <InputSection title="选择知识" meta={`${selectedSources.length} 份已选`}>
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
              <div className="flex items-start justify-between gap-3 rounded-xl bg-[#e9f0ec] px-3 py-2.5" key={source.id}>
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{source.title}</p><p className="text-[11px] text-slate-500">{sourceLabel(source.source)}</p></div>
                <button className="text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy !== null} onClick={() => { setSelectedSources((items) => items.filter((item) => item.id !== source.id)); setSuggestions([]); setBrief(null); setProject(null); }} type="button">移除</button>
              </div>
            ))}
          </div>
        </InputSection>

        {message ? <p className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900" role="status">{message}</p> : null}
        <div className="border-t border-slate-200 px-5 py-4">
          <button className={`${primaryButtonClass} w-full`} disabled={!canCreateBrief || busy !== null} onClick={generateBrief} type="button">
            {busy === "brief" ? "AI 正在生成内容简报" : brief ? "重新生成内容简报" : "生成内容简报"}
          </button>
          {!canCreateBrief ? <p className="mt-2 text-center text-[11px] text-slate-400">填写选题并选择至少 1 份资料后可生成。</p> : null}
        </div>
      </div>

      <div className="min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
            <div><h3 className="text-xs font-semibold text-slate-700">知识引用</h3><div className="mt-2 grid gap-2">{brief.citations.map((citation) => <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={`${citation.sourceId}:${citation.excerpt}`}><p className="text-xs font-semibold text-slate-800">{citation.sourceTitle} <span className="font-normal text-slate-400">· {citation.sourceId}</span></p><p className="mt-2 text-xs leading-5 text-slate-600">“{citation.excerpt}”</p><input className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs" onChange={(event) => setBrief((current) => current ? { ...current, citations: current.citations.map((item) => item === citation ? { ...item, purpose: event.target.value } : item) } : current)} value={citation.purpose} /></div>)}</div></div>
            <BriefListField label="待确认信息" value={brief.openQuestions} onChange={(value) => updateBrief(setBrief, "openQuestions", value)} />
            <div className="border-t border-slate-200 pt-5">
              <button className={`${primaryButtonClass} w-full`} disabled={Boolean(project) || busy === "confirm"} onClick={confirmBrief} type="button">{busy === "confirm" ? "正在原子保存" : project ? `已保存项目 ${project.id}` : "确认简报并创建内容项目"}</button>
            </div>
            </fieldset>
            {project ? (
              <ChannelGenerationPanel
                activeChannel={activeChannel}
                drafts={project.channelDrafts}
                generatingChannels={generatingChannels}
                onGenerate={generateChannels}
                onRetry={retryChannel}
                onSelect={setActiveChannel}
                onToggle={toggleChannel}
                selectedChannels={selectedChannels}
              />
            ) : null}
          </div>
        ) : <div className="flex min-h-[650px] flex-col items-center justify-center px-6 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#e9f0ec] text-lg font-semibold text-emerald-900">简</div><h3 className="mt-5 text-base font-semibold text-slate-900">简报会出现在这里</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">它会固定目标受众、核心观点、结构、行动引导和可追溯引用。</p></div>}
      </div>
    </section>
  );
}

function ChannelGenerationPanel({
  activeChannel,
  drafts,
  generatingChannels,
  onGenerate,
  onRetry,
  onSelect,
  onToggle,
  selectedChannels,
}: {
  activeChannel: ContentChannel;
  drafts: ChannelDraft[];
  generatingChannels: ContentChannel[];
  onGenerate: () => void;
  onRetry: (channel: ContentChannel) => void;
  onSelect: (channel: ContentChannel) => void;
  onToggle: (channel: ContentChannel) => void;
  selectedChannels: ContentChannel[];
}) {
  const activeDraft = drafts.find((draft) => draft.channel === activeChannel) ?? drafts[0];
  const generating = generatingChannels.length > 0;

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">生成渠道内容</h3>
          <p className="mt-1 text-xs text-slate-500">四套独立 Prompt，共享上方已确认的事实简报。</p>
        </div>
        <button className="shrink-0 text-xs font-semibold text-emerald-800" onClick={() => contentChannels.forEach((channel) => {
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
              disabled={generating}
              key={channel}
              onClick={() => onToggle(channel)}
              type="button"
            >
              {selected ? "✓ " : "○ "}{channelLabels[channel]}
            </button>
          );
        })}
      </div>

      <button className={`${primaryButtonClass} mt-3 w-full`} disabled={!selectedChannels.length || generating} onClick={onGenerate} type="button">
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
                <button className="text-xs font-semibold text-emerald-800 disabled:text-slate-400" disabled={generating} onClick={() => onRetry(activeDraft.channel)} type="button">
                  {generatingChannels.includes(activeDraft.channel) ? "重试中" : generating ? "生成中" : "单独重试"}
                </button>
              </div>
              {activeDraft.status === "failed"
                ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">{activeDraft.error || "未知错误"}</p>
                : <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{activeDraft.content}</div>}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

function BriefField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="grid gap-2 text-xs font-semibold text-slate-700"><span>{label}</span>{multiline ? <textarea className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6" onChange={(event) => onChange(event.target.value)} value={value} /> : <input className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" onChange={(event) => onChange(event.target.value)} value={value} />}</label>;
}

function BriefListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="grid gap-2 text-xs font-semibold text-slate-700"><span>{label} <span className="font-normal text-slate-400">（每行一项）</span></span><textarea className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6" onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} value={value.join("\n")} /></label>;
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
