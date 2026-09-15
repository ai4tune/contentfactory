"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AppShell,
  PageHeader,
  secondaryButtonClass,
} from "@/components/app-shell";
import { PositioningClient } from "@/app/positioning/positioning-client";
import { StyleProfileWorkspace } from "@/modules/style-profile/components/style-profile-workspace";
import type { AccountContext } from "@/modules/positioning/types";
import type { AccountCapture } from "@/modules/positioning/capture";
import type { StyleProfile } from "@/modules/style-profile/types";

type BrandTab = "positioning" | "style";

const tabs: { id: BrandTab; label: string; description: string }[] = [
  { id: "positioning", label: "企业定位", description: "我是谁、做什么、服务谁" },
  { id: "style", label: "品牌表达", description: "怎么说话、什么风格" },
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
        title="企业资料"
        description="集中管理企业知识、账号定位和品牌表达，所有内容计划与创作都会复用这里的确认结果。"
        actions={
          <>
            <Link className={secondaryButtonClass} href="/knowledge">企业知识库</Link>
            <Link className={secondaryButtonClass} href="/setup">查看建档状态</Link>
          </>
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
      </div>
    </AppShell>
  );
}
