"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";

type TopicRadarResult = {
  keywordGroups: Array<{ group: string; keywords: string[]; intent: string }>;
  searchTasks: Array<{ platform: string; query: string; why: string }>;
  hotSampleInsights: string[];
  topicCandidates: Array<{
    title: string;
    platform: string;
    angle: string;
    sourceKeyword: string;
    priority: string;
  }>;
  validationChecklist: string[];
  nextActions: string[];
};

const initialForm = {
  accountPosition: "",
  targetAudience: "",
  offer: "",
  platforms: "小红书、公众号、视频号",
  keywordSeeds: "",
  hotSamples: "",
  contentGoal: "获客、信任建设、成交转化",
};

export default function TopicsPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<TopicRadarResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/positioning/current")
      .then((response) => response.json())
      .then((payload: {
        context?: {
          status: "confirmed" | "skipped";
          accountPosition?: string;
          targetAudience?: string[];
          offer?: string;
          platforms?: string[];
          conversionGoal?: string;
        } | null;
      }) => {
        if (payload.context?.status !== "confirmed") return;
        setForm((current) => ({
          ...current,
          accountPosition: payload.context?.accountPosition || current.accountPosition,
          targetAudience: payload.context?.targetAudience?.join("、") || current.targetAudience,
          offer: payload.context?.offer || current.offer,
          platforms: payload.context?.platforms?.join("、") || current.platforms,
          contentGoal: payload.context?.conversionGoal || current.contentGoal,
        }));
      })
      .catch(() => undefined);
  }, []);

  async function analyze() {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/topics/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { result?: TopicRadarResult; error?: string };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "选题雷达分析失败");
      }

      setResult(payload.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "选题雷达分析失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/topics">
      <PageHeader
        eyebrow="TOPIC RADAR"
        title="选题雷达"
        description="系统已自动读取当前账号定位。用关键词和爆款样本生成一批值得验证的内容方向。"
        actions={<Link className={primaryButtonClass} href="/create">去写文章</Link>}
      />

        <section className="mt-7 grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-semibold">输入定位与市场样本</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                先从账号定位生成关键词，再用爆款样本校准选题方向。
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              <TextArea
                label="当前账号定位（自动读取）"
                required
                value={form.accountPosition}
                onChange={(value) => setForm({ ...form, accountPosition: value })}
                placeholder="请先完成账号定位，系统会自动带入"
                rows={5}
              />
              <Field
                label="目标人群"
                value={form.targetAudience}
                onChange={(value) => setForm({ ...form, targetAudience: value })}
                placeholder="例如：准备装修的本地业主、设计师、渠道商"
              />
              <Field
                label="产品/服务"
                value={form.offer}
                onChange={(value) => setForm({ ...form, offer: value })}
                placeholder="例如：地板、安装服务、整屋搭配方案"
              />
              <Field
                label="主要平台"
                value={form.platforms}
                onChange={(value) => setForm({ ...form, platforms: value })}
                placeholder="小红书、公众号、视频号"
              />
              <TextArea
                label="关键词种子"
                value={form.keywordSeeds}
                onChange={(value) => setForm({ ...form, keywordSeeds: value })}
                placeholder="粘贴上一步生成的关键词，或先留空让 AI 生成"
                rows={4}
              />
              <TextArea
                label="爆款样本"
                value={form.hotSamples}
                onChange={(value) => setForm({ ...form, hotSamples: value })}
                placeholder="手动粘贴爆款标题、链接、正文摘要、点赞收藏数据。MVP 阶段先不自动抓取平台。"
                rows={7}
              />
              <Field
                label="内容目标"
                value={form.contentGoal}
                onChange={(value) => setForm({ ...form, contentGoal: value })}
                placeholder="获客、信任建设、成交转化"
              />
            </div>

            {error ? (
              <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            <button
              onClick={analyze}
              disabled={busy}
              className="mt-5 h-11 w-full bg-neutral-950 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {busy ? "分析中" : "生成选题雷达"}
            </button>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-semibold">关键词、爆款与选题</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                输出结果会成为后续爆款库和文章生产台的输入。
              </p>
            </div>

            {result ? (
              <div className="mt-5 space-y-6">
                <KeywordGroups groups={result.keywordGroups} />
                <SearchTasks tasks={result.searchTasks} />
                <ResultList title="爆款样本洞察" items={result.hotSampleInsights} />
                <TopicCandidates topics={result.topicCandidates} />
                <ResultList title="验证清单" items={result.validationChecklist} />
                <ResultList title="下一步动作" items={result.nextActions} />
              </div>
            ) : (
              <div className="mt-5 flex min-h-[560px] items-center justify-center border border-dashed border-neutral-200 p-6 text-center text-sm leading-6 text-neutral-400">
                填写定位和样本后，关键词池、搜索任务、爆款洞察和选题列表会出现在这里。
              </div>
            )}
          </div>
        </section>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-950"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-neutral-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="resize-none border border-neutral-300 px-3 py-2 text-sm leading-6 outline-none focus:border-neutral-950"
      />
    </label>
  );
}

function KeywordGroups({
  groups,
}: {
  groups: Array<{ group: string; keywords: string[]; intent: string }>;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">关键词分组</h3>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <article key={group.group} className="border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-semibold">{group.group}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{group.intent}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.keywords.map((keyword) => (
                <span key={keyword} className="border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700">
                  {keyword}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchTasks({ tasks }: { tasks: Array<{ platform: string; query: string; why: string }> }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">搜索任务</h3>
      <div className="mt-2 overflow-hidden border border-neutral-200">
        <div className="grid grid-cols-[88px_1fr_1.2fr] bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
          <span>平台</span>
          <span>搜索词</span>
          <span>目的</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {tasks.map((task) => (
            <div key={`${task.platform}-${task.query}`} className="grid grid-cols-[88px_1fr_1.2fr] gap-3 px-3 py-3 text-sm">
              <span className="font-medium">{task.platform}</span>
              <span>{task.query}</span>
              <span className="text-neutral-600">{task.why}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopicCandidates({
  topics,
}: {
  topics: Array<{
    title: string;
    platform: string;
    angle: string;
    sourceKeyword: string;
    priority: string;
  }>;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">我们的选题候选</h3>
      <div className="mt-2 grid gap-3">
        {topics.map((topic) => (
          <article key={topic.title} className="border border-neutral-200 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <h4 className="text-sm font-semibold">{topic.title}</h4>
              <span className="text-xs font-medium text-neutral-500">
                {topic.platform} · {topic.priority}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{topic.angle}</p>
            <p className="mt-2 text-xs text-neutral-500">来源关键词：{topic.sourceKeyword}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {items.length ? (
        <ul className="mt-2 grid gap-2">
          {items.map((item) => (
            <li key={item} className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">暂无</p>
      )}
    </section>
  );
}
