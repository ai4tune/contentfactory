"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppShell,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/app-shell";

type IdeasTab = "discover" | "recommend" | "pool" | "viral" | "used";

const VALID_TABS: IdeasTab[] = ["discover", "recommend", "pool", "viral", "used"];

const tabs: { id: IdeasTab; label: string; description: string }[] = [
  { id: "discover", label: "发现", description: "从市场搜索、热榜、趋势中发现灵感" },
  { id: "recommend", label: "推荐", description: "系统根据你的定位推荐选题" },
  { id: "pool", label: "选题池", description: "已收藏待创作的选题" },
  { id: "viral", label: "爆款库", description: "已拆解的高表现内容" },
  { id: "used", label: "已使用", description: "已进入创作流程的选题" },
];

export default function IdeasPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-400">加载中…</div>}>
      <IdeasPageContent />
    </Suspense>
  );
}

function IdeasPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam && VALID_TABS.includes(tabParam as IdeasTab) ? (tabParam as IdeasTab) : "discover";
  const [activeTab, setActiveTab] = useState<IdeasTab>(initialTab);

  return (
    <AppShell active="/ideas">
      <PageHeader
        eyebrow="IDEAS & TOPICS"
        title="灵感与选题"
        description="什么值得写。从市场趋势、爆款内容和企业知识中发现最佳选题。"
        actions={
          <div className="flex gap-2">
            <Link className={secondaryButtonClass} href="/topics">
              选题雷达
            </Link>
            <Link className={primaryButtonClass} href="/create">
              开始创作
            </Link>
          </div>
        }
      />

      {/* Tab 导航 */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-b-2 border-emerald-700 text-emerald-800"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="mt-6">
        {activeTab === "discover" && <DiscoverTab />}
        {activeTab === "recommend" && <RecommendTab />}
        {activeTab === "pool" && <PoolTab />}
        {activeTab === "viral" && <ViralTab />}
        {activeTab === "used" && <UsedTab />}
      </div>
    </AppShell>
  );
}

function DiscoverTab() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  return (
    <div className="space-y-6">
      {/* 市场搜索入口 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">市场搜索</h2>
        <p className="mt-2 text-sm text-slate-500">
          输入关键词，从全网搜索相关内容，发现市场机会。
        </p>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入关键词，如：AI获客、内容营销..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyword.trim()) {
                router.push(`/radar?tab=search&q=${encodeURIComponent(keyword.trim())}`);
              }
            }}
          />
          <button
            className={primaryButtonClass}
            onClick={() => {
              if (keyword.trim()) {
                router.push(`/radar?tab=search&q=${encodeURIComponent(keyword.trim())}`);
              }
            }}
          >
            搜索
          </button>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/radar"
          className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-200 hover:bg-emerald-50/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
              雷
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-800">
                市场雷达
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                热榜、趋势、对标账号
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/topics"
          className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-200 hover:bg-emerald-50/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-lg text-purple-600">
              题
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-800">
                选题雷达
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                AI 分析爆款、生成选题
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* 热门话题 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">热门话题</h2>
        <p className="mt-2 text-sm text-slate-500">
          最近在各平台受到关注的话题。
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-400">热榜功能即将上线</p>
          <p className="mt-1 text-xs text-slate-400">
            配置 RedFox API 后可自动获取各平台热榜数据
          </p>
        </div>
      </div>
    </div>
  );
}

function RecommendTab() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">系统推荐</h2>
      <p className="mt-2 text-sm text-slate-500">
        系统根据你的账号定位、目标客户、企业知识和历史表现，自动推荐今天值得写的选题。
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-400">智能推荐功能即将上线</p>
        <p className="mt-1 text-xs text-slate-400">
          需要先配置市场数据源和企业知识库
        </p>
      </div>
    </div>
  );
}

type Idea = {
  id: string;
  title: string;
  summary?: string;
  source_url?: string;
  platform?: string;
  status: string;
  created_at: string;
};

function PoolTab() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=pool")
      .then((res) => res.json())
      .then((data) => setIdeas(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleStartCreation = async (ideaId: string) => {
    setStartingId(ideaId);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/create-project`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.data?.createUrl) {
        router.push(data.data.createUrl);
      }
    } catch {
      // ignore
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">选题池</h2>
          <p className="mt-2 text-sm text-slate-500">
            已收藏待创作的选题。从市场搜索或推荐中收藏选题，然后进入创作流程。
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {ideas.length} 个选题
        </span>
      </div>
      {loading ? (
        <div className="mt-6 text-center text-sm text-slate-400">加载中…</div>
      ) : ideas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-400">还没有收藏的选题</p>
          <p className="mt-1 text-xs text-slate-400">
            从市场搜索中收藏感兴趣的选题
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-slate-900 line-clamp-1">{idea.title}</h3>
                {idea.summary && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-1">{idea.summary}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {idea.platform && `${idea.platform} · `}
                  {new Date(idea.created_at).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <div className="ml-4 flex gap-2">
                {idea.source_url && (
                  <a
                    href={idea.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    原文
                  </a>
                )}
                <button
                  onClick={() => handleStartCreation(idea.id)}
                  disabled={startingId === idea.id}
                  className="inline-flex h-8 items-center rounded-lg bg-[#173e32] px-3 text-xs font-medium text-white hover:bg-[#0e2d24] disabled:opacity-50"
                >
                  {startingId === idea.id ? "跳转中…" : "开始创作"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ViralTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">爆款库</h2>
          <p className="mt-1 text-sm text-slate-500">
            已拆解的高表现内容。学习结构，不照抄原文。
          </p>
        </div>
        <Link className={secondaryButtonClass} href="/inspirations">
          查看完整爆款库
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-400">从市场搜索中收藏内容，AI 会自动拆解</p>
        </div>
      </div>
    </div>
  );
}

function UsedTab() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">已使用选题</h2>
      <p className="mt-2 text-sm text-slate-500">
        已进入创作流程的选题。可以查看创作进度和发布状态。
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-400">还没有使用过的选题</p>
        <p className="mt-1 text-xs text-slate-400">
          从选题池中选择选题开始创作
        </p>
      </div>
    </div>
  );
}
