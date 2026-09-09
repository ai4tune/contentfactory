"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const initialTab = (searchParams.get("tab") as RadarTab) || "hot";
  const initialQuery = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState<RadarTab>(initialTab);

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
        {activeTab === "hot" && <HotTab />}
        {activeTab === "search" && <SearchTab initialQuery={initialQuery} />}
        {activeTab === "trends" && <TrendsTab />}
        {activeTab === "accounts" && <AccountsTab />}
      </div>
    </AppShell>
  );
}

function HotTab() {
  return (
    <div className="space-y-6">
      {/* 热词示例 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">全网热词</h2>
        <p className="mt-2 text-sm text-slate-500">
          以下为示例关键词，配置 RedFox API 后将显示实时热词。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["AI员工", "超级个体", "AI获客", "一人公司", "销售自动化"].map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-500"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {/* 平台状态 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">平台热榜</h2>
        <p className="mt-2 text-sm text-slate-500">
          配置 RedFox API Key 后，可自动获取各平台热榜数据。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {["小红书", "抖音", "视频号", "公众号"].map((name) => (
            <div
              key={name}
              className="rounded-xl border border-dashed border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  待配置
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                配置后自动获取热榜
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 配置提示 */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <h3 className="font-semibold text-slate-900">配置市场数据源</h3>
        <p className="mt-2 text-sm text-slate-500">
          在 <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">.env.local</code> 中配置 <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">REDFOX_API_KEY</code> 后，系统可以自动获取各平台热榜、搜索和趋势数据。
        </p>
      </div>
    </div>
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
        throw new Error(data.error || "搜索失败");
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
          输入关键词，从全网搜索相关内容，发现市场机会。
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {/* 平台选择 */}
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as MarketPlatform)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="xiaohongshu">小红书</option>
            <option value="douyin">抖音</option>
            <option value="wechat">公众号</option>
          </select>

          {/* 关键词输入 */}
          <input
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
            { step: 1, title: "关键词扩展", desc: "AI 自动生成 5-10 个相关关键词" },
            { step: 2, title: "全网搜索", desc: "从小红书、抖音、视频号等平台搜索" },
            { step: 3, title: "数据标准化", desc: "统一数据格式，去重排序" },
            { step: 4, title: "机会评分", desc: "根据热度、匹配度、商业价值评分" },
            { step: 5, title: "AI 分析", desc: "生成选题建议和创作方向" },
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

function TrendsTab() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">趋势分析</h2>
      <p className="mt-2 text-sm text-slate-500">
        找到正在上涨的方向。分析 7 天、14 天、30 天的趋势变化。
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-400">趋势分析功能即将上线</p>
        <p className="mt-1 text-xs text-slate-400">
          配置 RedFox API 后可自动分析趋势数据
        </p>
      </div>
    </div>
  );
}

function SearchResultCard({ item }: { item: MarketItem }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creatingIdea, setCreatingIdea] = useState(false);

  const handleSaveToInspiration = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/market/items/${item.id}/save-to-inspiration`, { method: "POST" });
      if (res.ok) setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleCreateIdea = async () => {
    setCreatingIdea(true);
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
      }
    } catch {
      // ignore
    } finally {
      setCreatingIdea(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30">
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

function AccountsTab() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">对标账号</h2>
      <p className="mt-2 text-sm text-slate-500">
        追踪竞争对手和参考账号，学习他们的内容策略。
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-400">账号追踪功能即将上线</p>
        <p className="mt-1 text-xs text-slate-400">
          配置 RedFox API 后可追踪对标账号
        </p>
      </div>
    </div>
  );
}
