"use client";

import { useState } from "react";
import {
  AppShell,
  PageHeader,
} from "@/components/app-shell";
import { PositioningClient } from "@/app/positioning/positioning-client";
import { StyleProfileWorkspace } from "@/modules/style-profile/components/style-profile-workspace";
import type { AccountContext } from "@/modules/positioning/types";
import type { AccountCapture } from "@/modules/positioning/capture";
import type { StyleProfile } from "@/modules/style-profile/types";

type BrandTab = "positioning" | "style" | "audience" | "products";

const tabs: { id: BrandTab; label: string; description: string }[] = [
  { id: "positioning", label: "企业定位", description: "我是谁、做什么、服务谁" },
  { id: "style", label: "品牌表达", description: "怎么说话、什么风格" },
  { id: "audience", label: "目标客户", description: "写给谁、他们关心什么" },
  { id: "products", label: "产品与服务", description: "卖什么、有什么优势" },
];

export function BrandClient({
  initialContext,
  initialCapture,
  initialProfile,
  initialConfirmedProfile,
  extensionPath,
}: {
  initialContext: AccountContext | null;
  initialCapture: AccountCapture | null;
  initialProfile: StyleProfile | null;
  initialConfirmedProfile: StyleProfile | null;
  extensionPath: string;
}) {
  const [activeTab, setActiveTab] = useState<BrandTab>("positioning");

  return (
    <AppShell active="/brand">
      <PageHeader
        eyebrow="企业资产"
        title="账号与品牌"
        description="我是谁、写给谁、怎么表达。这里集中管理账号定位、品牌风格和目标客户。"
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
        {activeTab === "positioning" && (
          <div>
            <div className="mb-4 rounded-xl bg-[#e9f0ec] p-4">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">企业定位</span> 是内容创作的基础。
                系统会根据定位来理解你的企业是谁、做什么、服务谁，从而生成更符合品牌的内容。
              </p>
            </div>
            <PositioningClient
              initialContext={initialContext}
              initialCapture={initialCapture}
              extensionPath={extensionPath}
              bare
            />
          </div>
        )}

        {activeTab === "style" && (
          <div>
            <div className="mb-4 rounded-xl bg-[#e9f0ec] p-4">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">品牌表达</span> 定义了内容的语气、风格和表达习惯。
                系统会学习你的写作风格，让生成的内容更像你本人。
              </p>
            </div>
            <StyleProfileWorkspace
              accountName={initialContext?.accountName ?? "当前账号"}
              initialConfirmedProfile={initialConfirmedProfile}
              initialProfile={initialProfile}
            />
          </div>
        )}

        {activeTab === "audience" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">目标客户</h2>
            <p className="mt-2 text-sm text-slate-500">
              定义你的目标客户画像，包括他们的痛点、需求和关注点。
              这将帮助系统生成更有针对性的内容。
            </p>
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-400">目标客户管理功能即将上线</p>
              <p className="mt-1 text-xs text-slate-400">
                当前可通过企业定位中的目标客群字段定义客户画像
              </p>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">产品与服务</h2>
            <p className="mt-2 text-sm text-slate-500">
              管理你的产品和服务信息，包括核心优势、定价策略和客户案例。
              这些信息将用于内容创作时的事实支撑。
            </p>
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-400">产品管理功能即将上线</p>
              <p className="mt-1 text-xs text-slate-400">
                当前可通过企业知识库上传产品资料
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
