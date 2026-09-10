"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AppShell,
  PageHeader,
  primaryButtonClass,
} from "@/components/app-shell";
import type { MarketItem, MarketPlatform } from "@/modules/market/types";
import {
  formatNumber,
  formatTimeAgo,
  formatPlatformName,
} from "@/modules/market/utils";

import { HotPanel, TrendsPanel, AccountsPanel } from "@/modules/market/radar-panels";

type RadarTab = "hot" | "search" | "trends" | "accounts";

const tabs: { id: RadarTab; label: string; description: string }[] = [
  { id: "hot", label: "热榜", description: "今天/本周什么内容正在受到关注" },
  { id: "search", label: "主题搜索", description: "输入关键词搜索相关内容" },
  { id: "trends", label: "趋势", description: "找到正在上涨的方向" },
  { id: "accounts", label: "对标账号", description: "追踪竞争对手和参考账号" },
];

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-400">加载中…</div>}>
      <RadarPageContent />
    </Suspense>
  );
}

function RadarPageContent() {
  const searchParams = useSearchParams();
  const activeTab = tabs.find(tab => tab.id === searchParams.get("tab"))?.id || "hot";
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  return (
    <AppShell active="/radar">
      <PageHeader
        eyebrow="MARKET RADAR"
        title="市场雷达"
        description="外部市场正在发生什么。发现热门内容、追踪趋势、找到市场机会。"
        actions={
          <Link className={primaryButtonClass} href="/ideas">
            查看灵感与选题
          </Link>
        }
      />

      {/* Tab 导航 */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(`/radar?tab=${tab.id}`)}
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
        {activeTab === "hot" && <HotPanel ItemCard={SearchResultCard} />}
        {activeTab === "search" && <SearchTab key={initialQuery} initialQuery={initialQuery} />}
        {activeTab === "trends" && <TrendsPanel />}
        {activeTab === "accounts" && <AccountsPanel ItemCard={SearchResultCard} />}
      </div>
    </AppShell>
  );
}

function SearchTab({ initialQuery = "" }: { initialQuery?: string }) {
  const [keyword, setKeyword] = useState(initialQuery);
  const [platform, setPlatform] = useState<MarketPlatform>("xiaohongshu");
  const [searchResults, setSearchResults] = useState<MarketItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);


  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch("/api/market/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          keyword: keyword.trim(),
          page: 1,
          pageSize: 20,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "搜索失败");
      }

      setSearchResults(data.data?.items || []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">主题搜索</h2>
        <p className="mt-2 text-sm text-slate-500">
          自由输入关键词，例如“咖啡店”“AI 企业落地”，搜索所选平台的相关内容。不受榜单分类限制；当前使用综合排序、时间不限。
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {/* 平台选择 */}
          <select
            aria-label="搜索平台"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as MarketPlatform)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="xiaohongshu">小红书</option>
            <option value="douyin">抖音</option>
            <option value="wechat">公众号</option>
            <option value="channels">视频号</option>
          </select>

          {/* 关键词输入 */}
          <input
            aria-label="搜索关键词"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入关键词，如：AI获客、内容营销..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />

          {/* 搜索按钮 */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !keyword.trim()}
            className={`${primaryButtonClass} ${isSearching ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSearching ? "搜索中..." : "搜索"}
          </button>
        </div>
      </div>

      {/* 搜索错误 */}
      {searchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{searchError}</p>
        </div>
      )}

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">搜索结果</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {searchResults.length} 条结果
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {searchResults.map((item) => (
              <SearchResultCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 搜索说明 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">搜索流程</h2>
        <div className="mt-4 space-y-3">
          {[
            { step: 1, title: "输入关键词", desc: "选择平台，搜索你想了解的主题" },
            { step: 2, title: "查询内容", desc: "支持小红书、抖音、公众号和视频号，结果取决于数据源覆盖范围" },
            { step: 3, title: "查看结果", desc: "统一展示来源和可用指标，缺失数据不会补造" },
            { step: 4, title: "进入创作", desc: "收藏到爆款库，或转为选题后结合知识库创作" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                {item.step}
              </span>
              <div>
                <span className="font-medium text-slate-900">{item.title}</span>
                <span className="ml-2 text-sm text-slate-500">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchResultCard({ item }: { item: MarketItem }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creatingIdea, setCreatingIdea] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveToInspiration = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/items/${item.id}/save-to-inspiration`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "收藏失败，请重试。");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "收藏失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateIdea = async () => {
    setCreatingIdea(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          sourceUrl: item.sourceUrl || item.canonicalUrl,
          platform: item.platform,
          marketItemId: item.id,
          summary: item.summary,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.id) {
          window.location.href = `/ideas?tab=pool`;
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "创建选题失败，请重试。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建选题失败，请重试。");
    } finally {
      setCreatingIdea(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30">
      {error ? <p role="alert" className="mb-3 text-sm text-red-700">{error}</p> : null}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {formatPlatformName(item.platform)}
            </span>
            <span className="text-xs text-slate-400">{item.author.name}</span>
          </div>
          <h3 className="mt-2 font-medium text-slate-900 line-clamp-2">
            {item.title}
          </h3>
          {item.summary && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">
              {item.summary}
            </p>
          )}
        </div>
        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold text-emerald-700">
            {formatNumber(item.metrics.likes)}
          </span>
          <span className="text-xs text-slate-400">点赞</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span>阅读 {formatNumber(item.metrics.views)}</span>
        <span>收藏 {formatNumber(item.metrics.collects)}</span>
        <span>评论 {formatNumber(item.metrics.comments)}</span>
        {item.publishedAt && <span>{formatTimeAgo(item.publishedAt)}</span>}
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {(item.sourceUrl || item.canonicalUrl) && (
          <a
            href={item.sourceUrl || item.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            查看原文 ↗
          </a>
        )}
        <button
          onClick={handleSaveToInspiration}
          disabled={saving || saved}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition ${
            saved
              ? "bg-emerald-100 text-emerald-700"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {saved ? "✓ 已收藏" : saving ? "收藏中…" : "收藏到爆款库"}
        </button>
        <button
          onClick={handleCreateIdea}
          disabled={creatingIdea}
          className="inline-flex h-8 items-center rounded-lg bg-[#173e32] px-3 text-xs font-medium text-white transition hover:bg-[#0e2d24] disabled:opacity-50"
        >
          {creatingIdea ? "创建中…" : "创建选题"}
        </button>
      </div>
    </div>
  );
}
