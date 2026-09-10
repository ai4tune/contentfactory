"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, primaryButtonClass } from "@/components/app-shell";

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

export default function TopicWorkspace() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<TopicRadarResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Array<{ id: string; title: string }>>([]);
  const [sampleIds, setSampleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/topics/radar").then(r => { if (!r.ok) throw new Error("推荐历史读取失败"); return r.json(); }), fetch("/api/inspirations").then(r => { if (!r.ok) throw new Error("爆款样本读取失败"); return r.json(); }), fetch("/api/positioning/current").then(r => { if (!r.ok) throw new Error("账号定位读取失败"); return r.json(); })]).then(([history, library, account]) => {
      if (!active) return;
      setSamples(library.inspirations || []);
      if (history.record) { setResult(history.record.result); setForm(current => ({ ...current, ...history.record.input })); setSampleIds(history.record.input.sampleIds || []); }
      else if (account.context?.status === "confirmed") {
        const context = account.context;
        setForm(current => ({ ...current, accountPosition: context.accountPosition || current.accountPosition, targetAudience: context.targetAudience?.join("、") || current.targetAudience, offer: context.offer || current.offer, platforms: context.platforms?.join("、") || current.platforms, contentGoal: context.conversionGoal || current.contentGoal }));
      }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function analyze() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/topics/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sampleIds }),
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
    <div>
      <PageHeader
        eyebrow="TOPIC RADAR"
        title="AI 选题推荐"
        description="根据账号定位和你选择的爆款样本生成方向，不自动抓取市场数据。上次推荐会自动恢复。"
        actions={<Link className={primaryButtonClass} href="/create">去写文章</Link>}
      />

        <fieldset disabled={loading || busy} className="mt-7 grid min-w-0 gap-5 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-semibold">输入定位与市场样本</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                先从账号定位生成关键词，再用爆款样本校准选题方向。
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              <TextArea
                label="本次推荐的账号定位（首次自动读取，可调整）"
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

            <label className="mt-4 block text-sm">参考已收藏爆款（最多 5 篇）<select multiple aria-label="参考爆款" className="mt-2 w-full rounded-lg border p-2" value={sampleIds} onChange={event => setSampleIds(Array.from(event.target.selectedOptions).map(option => option.value).slice(0, 5))}>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.title}</option>)}</select></label>
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
              {loading ? "恢复上次推荐…" : busy ? "分析中" : "生成 AI 选题推荐"}
            </button>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-semibold">关键词、爆款与选题</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                将感兴趣的候选加入选题池，再从选题池进入创作。
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
        </fieldset>
    </div>
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
        <div className="grid grid-cols-[88px_1fr_1.2fr_88px] bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
          <span>平台</span>
          <span>搜索词</span>
          <span>目的</span>
          <span>操作</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {tasks.map((task) => (
            <div key={`${task.platform}-${task.query}`} className="grid grid-cols-[88px_1fr_1.2fr_88px] gap-3 px-3 py-3 text-sm">
              <span className="font-medium">{task.platform}</span>
              <span>{task.query}</span>
              <span className="text-neutral-600">{task.why}</span>
              {task.platform.includes("小红书") ? (
                <a
                  href={`/radar?tab=search&q=${encodeURIComponent(task.query)}`}
                  className="font-medium text-emerald-800 hover:underline"
                >
                  去搜索
                </a>
              ) : <span className="text-neutral-400">手动搜索</span>}
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
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function save(topic: typeof topics[number]) {
    setBusy(topic.title); setError("");
    try {
      const response = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: topic.title, summary: `${topic.angle}\n来源关键词：${topic.sourceKeyword}`, platform: topic.platform }) });
      if (!response.ok) throw new Error("选题保存失败，请重试");
      setSaved(current => [...current, topic.title]);
    } catch (error) { setError(error instanceof Error ? error.message : "选题保存失败"); } finally { setBusy(null); }
  }
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">我们的选题候选</h3>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <Link href="/ideas?tab=pool" className="text-sm text-emerald-700 underline">查看选题池 →</Link>
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
            <button className="mt-3 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={busy !== null || saved.includes(topic.title)} onClick={() => save(topic)}>{saved.includes(topic.title) ? "已加入选题池" : busy === topic.title ? "保存中…" : "加入选题池"}</button>
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
