"use client";

import { useEffect, useState, type ReactNode } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";

type KnowledgeSource = {
  id: string;
  title: string;
  url?: string;
  source: "feishu" | "base" | "upload";
  text?: string;
};

type GenerateResult = {
  positioning: string;
  outline: string[];
  draft: string;
  audit: string[];
  citations: Array<{ title: string; reason: string }>;
};

const channelOptions = ["公众号文章", "小红书笔记", "朋友圈文案", "短视频脚本"];

export function ContentCreationWorkspace() {
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState(channelOptions[0]);
  const [searchItems, setSearchItems] = useState<KnowledgeSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<KnowledgeSource[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materials", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { materials?: KnowledgeSource[] }) => setSearchItems(payload.materials ?? []))
      .catch(() => setMessage("知识资料读取失败，请稍后重试。"));
  }, []);

  const canGenerate = topic.trim().length > 0 && selectedSources.length > 0;

  async function searchFeishu() {
    if (!query.trim()) {
      setMessage("请先输入飞书搜索关键词。");
      return;
    }

    setBusy("search");
    setMessage(null);

    try {
      const response = await fetch("/api/feishu/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = (await response.json()) as { items?: KnowledgeSource[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "搜索失败");
      }

      setSearchItems(payload.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setBusy(null);
    }
  }

  async function addKnowledgeSource(source: KnowledgeSource) {
    if (selectedSources.some((item) => item.id === source.id)) {
      return;
    }

    if (source.text) {
      setSelectedSources((items) => [...items, source]);
      return;
    }

    setBusy(`read:${source.id}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/feishu/documents/${encodeURIComponent(source.id)}`);
      const payload = (await response.json()) as { document?: KnowledgeSource; error?: string };

      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "读取文档失败");
      }

      setSelectedSources((items) => [...items, payload.document as KnowledgeSource]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取文档失败");
    } finally {
      setBusy(null);
    }
  }

  async function addFeishuUrl() {
    if (!feishuUrl.trim()) {
      setMessage("请先粘贴飞书文档或多维表格链接。");
      return;
    }

    setBusy("resolve");
    setMessage(null);

    try {
      const response = await fetch("/api/feishu/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feishuUrl }),
      });
      const payload = (await response.json()) as { document?: KnowledgeSource; error?: string };

      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "读取飞书链接失败");
      }

      if (!selectedSources.some((item) => item.id === payload.document?.id)) {
        setSelectedSources((items) => [...items, payload.document as KnowledgeSource]);
      }
      setFeishuUrl("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取飞书链接失败");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    setBusy("upload");
    setMessage(null);

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { sources?: KnowledgeSource[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "上传失败");
      }

      const sources = payload.sources ?? [];
      setSelectedSources((items) => [
        ...items,
        ...sources.filter((source) => !items.some((item) => item.id === source.id)),
      ]);
      setSearchItems((items) => [
        ...sources,
        ...items.filter((item) => !sources.some((source) => source.id === item.id)),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!canGenerate) {
      setMessage("需要填写选题并至少选择 1 份资料。");
      return;
    }

    setBusy("generate");
    setMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, sources: selectedSources }),
      });
      const payload = (await response.json()) as { result?: GenerateResult; error?: string };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "生成失败");
      }

      setResult(payload.result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 grid items-start gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">创作输入</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">先把选题和事实依据准备好，再让 AI 开始写。</p>
        </div>

        <InputSection title="确定选题">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <span>这次想写什么</span>
            <textarea
              className="min-h-24 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
              onChange={(event) => setTopic(event.target.value)}
              placeholder="例如：装修选地板时，怎么避免只看价格的误区？"
              value={topic}
            />
          </label>
        </InputSection>

        <InputSection title="选择知识" meta={`${selectedSources.length} 份已选`}>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="feishu-search">
                搜索飞书知识
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
                  id="feishu-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="产品、案例或观点"
                  value={query}
                />
                <button
                  className={`${secondaryButtonClass} shrink-0`}
                  disabled={busy === "search"}
                  onClick={searchFeishu}
                  type="button"
                >
                  {busy === "search" ? "搜索中" : "搜索"}
                </button>
              </div>
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">其他添加方式</summary>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-2 text-xs font-medium text-slate-600" htmlFor="feishu-url">
                  <span>飞书文档或多维表格链接</span>
                  <div className="flex gap-2">
                    <input
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-800"
                      id="feishu-url"
                      onChange={(event) => setFeishuUrl(event.target.value)}
                      placeholder="https://..."
                      value={feishuUrl}
                    />
                    <button
                      className={secondaryButtonClass}
                      disabled={busy === "resolve"}
                      onClick={addFeishuUrl}
                      type="button"
                    >
                      {busy === "resolve" ? "读取中" : "读取"}
                    </button>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-medium text-slate-600 transition hover:border-emerald-800">
                  <span>{busy === "upload" ? "正在读取文件" : "上传 TXT / MD / CSV"}</span>
                  <span>选择文件</span>
                  <input
                    accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                    className="sr-only"
                    multiple
                    onChange={(event) => uploadFiles(event.target.files)}
                    type="file"
                  />
                </label>
              </div>
            </details>

            {searchItems.length > 0 ? (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                {searchItems.slice(0, 10).map((item) => {
                  const selected = selectedSources.some((source) => source.id === item.id);
                  return (
                    <button
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 disabled:cursor-default disabled:bg-emerald-50/50"
                      disabled={selected || busy === `read:${item.id}`}
                      key={item.id}
                      onClick={() => addKnowledgeSource(item)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-700">{item.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{sourceLabel(item.source)}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-emerald-800">
                        {busy === `read:${item.id}` ? "读取中" : selected ? "已选" : "选择"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                尚未找到可用资料。可以搜索飞书，或从其他方式添加。
              </p>
            )}

            {selectedSources.length > 0 ? (
              <div className="grid gap-2">
                {selectedSources.map((source) => (
                  <div className="flex items-start justify-between gap-3 rounded-xl bg-[#e9f0ec] px-3 py-2.5" key={source.id}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{source.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{sourceLabel(source.source)}</p>
                    </div>
                    <button
                      className="shrink-0 text-xs text-slate-500 hover:text-slate-900"
                      onClick={() => setSelectedSources((items) => items.filter((item) => item.id !== source.id))}
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </InputSection>

        <InputSection title="选择渠道">
          <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="content-channel">
            <span>本次发布渠道</span>
            <select
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
              id="content-channel"
              onChange={(event) => setPlatform(event.target.value)}
              value={platform}
            >
              {channelOptions.map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">当前一次生成一个渠道，草稿会自动保存。</p>
        </InputSection>

        {message ? (
          <p className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900" role="status">
            {message}
          </p>
        ) : null}

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            className={`${primaryButtonClass} w-full active:translate-y-px`}
            disabled={!canGenerate || busy === "generate"}
            onClick={generate}
            type="button"
          >
            {busy === "generate" ? "AI 正在生成第一版" : "生成第一版"}
          </button>
          {!canGenerate ? (
            <p className="mt-2 text-center text-[11px] leading-5 text-slate-400">填写选题并选择至少 1 份资料后可开始生成。</p>
          ) : null}
        </div>
      </div>

      <div className="min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-950">内容结果</h2>
            <p className="mt-1 text-xs text-slate-500">{result ? `${platform} 第一版` : "等待创作输入"}</p>
          </div>
          {result ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">已生成</span> : null}
        </div>

        {busy === "generate" ? (
          <div className="grid gap-5 p-6" aria-live="polite">
            <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200" />
            <div className="grid gap-3">
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : result ? (
          <div className="grid gap-0 divide-y divide-slate-100">
            <ResultBlock title="本稿定位" body={result.positioning} />
            <ResultList title="内容大纲" items={result.outline} numbered />
            <ResultBlock title="内容初稿" body={result.draft} prominent />
            <ResultList title="审核建议" items={result.audit} />
            <ResultList
              title="知识引用"
              items={result.citations.map((item) => `${item.title}：${item.reason}`)}
            />
          </div>
        ) : (
          <div className="flex min-h-[650px] flex-col items-center justify-center px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#e9f0ec] text-lg font-semibold text-emerald-900">稿</div>
            <h3 className="mt-5 text-base font-semibold text-slate-900">结果会出现在这里</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              完成左侧的选题、知识和渠道选择，AI 会生成大纲、初稿、审核建议和引用说明。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function InputSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 px-5 py-5 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {meta ? <span className="text-xs font-medium text-emerald-800">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ResultBlock({
  title,
  body,
  prominent,
}: {
  title: string;
  body: string;
  prominent?: boolean;
}) {
  return (
    <section className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${prominent ? "text-slate-800" : "text-slate-600"}`}>
        {body || "暂无内容"}
      </div>
    </section>
  );
}

function ResultList({
  title,
  items,
  numbered,
}: {
  title: string;
  items: string[];
  numbered?: boolean;
}) {
  return (
    <section className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {items.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {items.map((item, index) => (
            <li className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600" key={`${title}-${index}`}>
              <span className="font-mono text-xs font-semibold text-emerald-800">{numbered ? index + 1 : "•"}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-400">暂无</p>
      )}
    </section>
  );
}

function sourceLabel(source: KnowledgeSource["source"]) {
  return source === "feishu" ? "飞书文档" : source === "base" ? "飞书多维表格" : "上传文件";
}
