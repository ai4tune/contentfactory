"use client";

import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";

type ConfigStatus = {
  feishuConfigured: boolean;
  aiConfigured: boolean;
  uploadEnabled: boolean;
};

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

const defaultStatus: ConfigStatus = {
  feishuConfigured: false,
  aiConfigured: false,
  uploadEnabled: true,
};

export default function Home() {
  const [status, setStatus] = useState<ConfigStatus>(defaultStatus);
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState("小红书");
  const [searchItems, setSearchItems] = useState<KnowledgeSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<KnowledgeSource[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setMessage("配置状态读取失败"));

    fetch("/api/materials", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { materials?: KnowledgeSource[] }) => setSearchItems(payload.materials ?? []))
      .catch(() => undefined);
  }, []);

  const canGenerate = topic.trim().length > 0 && selectedSources.length > 0;

  async function searchFeishu() {
    if (!query.trim()) {
      setMessage("先输入关键词");
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

  async function addFeishuSource(source: KnowledgeSource) {
    if (selectedSources.some((item) => item.id === source.id)) {
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
      setMessage("先粘贴飞书文档或多维表格链接");
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

      setSelectedSources((items) => [...items, payload.document as KnowledgeSource]);
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

      setSelectedSources((items) => [...items, ...(payload.sources ?? [])]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!canGenerate) {
      setMessage("需要选题和至少 1 份资料");
      return;
    }

    setBusy("generate");
    setMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, platform, sources: selectedSources }),
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
    <AppShell active="/workbench">
        <PageHeader
          eyebrow="CONTENT CREATION"
          title="写一篇内容"
          description="选择企业素材，确定选题和平台，AI 会结合当前账号定位生成大纲、草稿与审核建议。"
          actions={<div className="grid gap-2 text-sm sm:grid-cols-3"><StatusPill label="飞书知识库" ok={status.feishuConfigured} /><StatusPill label="AI Gateway" ok={status.aiConfigured} /><StatusPill label="临时上传" ok={status.uploadEnabled} /></div>}
        />

        {message ? (
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        ) : null}

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_0.9fr_1fr]">
          <div className="flex min-h-[520px] flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <SectionTitle title="1. 选择素材" subtitle="素材库内容会自动出现在下方，也可以继续搜索飞书" />
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：医美 私域 转化 案例"
                className="h-10 min-w-0 flex-1 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
              />
              <button
                onClick={searchFeishu}
                disabled={busy === "search"}
                className="h-10 bg-neutral-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {busy === "search" ? "搜索中" : "搜索"}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={feishuUrl}
                onChange={(event) => setFeishuUrl(event.target.value)}
                placeholder="粘贴飞书 docx/base 链接"
                className="h-10 min-w-0 flex-1 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
              />
              <button
                onClick={addFeishuUrl}
                disabled={busy === "resolve"}
                className="h-10 bg-neutral-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {busy === "resolve" ? "读取中" : "读取"}
              </button>
            </div>

            <label className="flex cursor-pointer items-center justify-between border border-dashed border-neutral-300 px-3 py-3 text-sm hover:border-neutral-900">
              <span>上传 txt / md / csv</span>
              <span className="text-neutral-500">{busy === "upload" ? "读取中" : "选择文件"}</span>
              <input
                type="file"
                multiple
                accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                onChange={(event) => uploadFiles(event.target.files)}
                className="sr-only"
              />
            </label>

            <div className="flex flex-1 flex-col gap-2 overflow-auto">
              {searchItems.length === 0 ? (
                <EmptyState text="素材库还没有内容。搜索飞书或上传文件后会出现在这里。" />
              ) : (
                searchItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addFeishuSource(item)}
                    disabled={busy === `read:${item.id}`}
                    className="border border-neutral-200 p-3 text-left text-sm hover:border-neutral-900 disabled:opacity-60"
                  >
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block truncate text-xs text-neutral-500">{item.id}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-[520px] flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <SectionTitle title="2. 选知识" subtitle="这些资料会进入改稿上下文" />
            <div className="flex flex-1 flex-col gap-2 overflow-auto">
              {selectedSources.length === 0 ? (
                <EmptyState text="还没有选择资料。" />
              ) : (
                selectedSources.map((source) => (
                  <article key={source.id} className="border border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{source.title}</p>
                        <p className="mt-1 text-xs text-neutral-500">{source.source}</p>
                      </div>
                      <button
                        onClick={() =>
                          setSelectedSources((items) => items.filter((item) => item.id !== source.id))
                        }
                        className="text-xs text-neutral-500 hover:text-neutral-950"
                      >
                        移除
                      </button>
                    </div>
                    <p className="mt-3 line-clamp-4 text-xs leading-5 text-neutral-600">
                      {source.text || "已选择，等待读取内容。"}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-[520px] flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <SectionTitle title="3. 生成初稿" subtitle="先跑定位、大纲、草稿和审计" />
            <div className="grid gap-3">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="本次选题"
                className="h-10 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
              />
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="目标人群"
                className="h-10 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
              />
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="h-10 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
              >
                <option>小红书</option>
                <option>公众号</option>
                <option>视频号</option>
                <option>短视频脚本</option>
              </select>
              <button
                onClick={generate}
                disabled={!canGenerate || busy === "generate"}
                className="h-10 bg-neutral-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {busy === "generate" ? "生成中" : "生成第一版"}
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-auto border-t border-neutral-200 pt-4">
              {result ? (
                <div className="space-y-5 text-sm">
                  <ResultBlock title="定位" body={result.positioning} />
                  <ResultList title="大纲" items={result.outline} />
                  <ResultBlock title="草稿" body={result.draft} />
                  <ResultList title="审计建议" items={result.audit} />
                  <ResultList
                    title="引用"
                    items={result.citations.map((item) => `${item.title}: ${item.reason}`)}
                  />
                </div>
              ) : (
                <EmptyState text="生成结果会出现在这里。" />
              )}
            </div>
          </div>
        </section>
    </AppShell>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-neutral-200 bg-white px-3 py-2">
      <span>{label}</span>
      <span className={ok ? "text-emerald-700" : "text-neutral-400"}>{ok ? "已配置" : "待配置"}</span>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-1 items-center justify-center border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
      {text}
    </div>
  );
}

function ResultBlock({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap leading-6 text-neutral-700">{body}</p>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ol className="list-decimal space-y-1 pl-5 leading-6 text-neutral-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ol>
      ) : (
        <p className="text-neutral-400">暂无</p>
      )}
    </section>
  );
}
