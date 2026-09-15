"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, contentChannels, type ContentChannel } from "@/modules/content/types";
import {
  loadLocalKnowledge,
  reconnectKnowledgeDirectory,
  supportsDirectoryPicker,
} from "@/modules/knowledge/local-index";
import type {
  OnboardingStatus,
  OnboardingStepId,
  OnboardingUpdate,
} from "@/modules/onboarding/types";
import type { AccountContext } from "@/modules/positioning/types";

type SetupAccountSummary = Pick<
  AccountContext,
  | "accountName"
  | "accountPosition"
  | "business"
  | "contentPillars"
  | "conversionGoal"
  | "offer"
  | "platforms"
  | "targetAudience"
>;

export type SetupWorkspaceData = {
  status: OnboardingStatus;
  account: SetupAccountSummary | null;
  styleProfile: { name: string; version: number } | null;
  serverKnowledgeCount: number;
};

const stepContent: Record<OnboardingStepId, { title: string; summary: string }> = {
  knowledge: { title: "连接企业资料", summary: "产品、案例、FAQ 和代表内容" },
  business: { title: "确认企业信息", summary: "业务、产品、客户和经营目标" },
  positioning: { title: "确认账号定位", summary: "账号角色和长期内容支柱" },
  primary_channel: { title: "选择主渠道", summary: "确定默认生成的内容形式" },
  style: { title: "确认写作风格", summary: "语气、禁用表达和代表原文" },
};

const stepOrder: OnboardingStepId[] = [
  "knowledge",
  "business",
  "positioning",
  "primary_channel",
  "style",
];

const channelDescriptions: Record<ContentChannel, string> = {
  wechat_article: "适合完整观点、案例讲解和长期信任建设",
  xiaohongshu_note: "适合发现流量、图文表达和消费决策内容",
  moments_post: "适合熟人关系、日常经营和轻量转化",
  short_video_script: "适合视频号、抖音等口播与短视频",
};

export function SetupWorkspace({ initialData }: { initialData: SetupWorkspaceData }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialData.status);
  const [activeStep, setActiveStep] = useState<OnboardingStepId>(() => firstIncomplete(initialData.status));
  const [primaryChannel, setPrimaryChannel] = useState<ContentChannel>(() =>
    initialData.status.primaryChannel ?? inferPrimaryChannel(initialData.account?.platforms ?? []),
  );
  const [localKnowledgeCount, setLocalKnowledgeCount] = useState(0);
  const [localPermission, setLocalPermission] = useState<PermissionState | "none" | "unsupported">("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const totalKnowledgeCount = localKnowledgeCount + initialData.serverKnowledgeCount;
  const completionCount = status.completedSteps.length;
  const canComplete = ["business", "positioning", "primary_channel"]
    .every((step) => status.completedSteps.includes(step as OnboardingStepId));

  useEffect(() => {
    let active = true;
    async function restoreLocalKnowledge() {
      try {
        if (!supportsDirectoryPicker()) {
          setLocalPermission("unsupported");
          const next = await patchStatus({ action: "sync", localKnowledgeCount: 0 });
          if (active) setStatus(next);
          return;
        }
        const cached = await loadLocalKnowledge();
        const restored = await reconnectKnowledgeDirectory();
        if (!active) return;
        const items = restored?.items ?? cached;
        setLocalKnowledgeCount(items.length);
        setLocalPermission(restored?.permission ?? "none");
        const next = await patchStatus({ action: "sync", localKnowledgeCount: items.length });
        if (active) setStatus(next);
      } catch {
        if (active) setMessage("本地知识库状态恢复失败，可前往知识库重新连接。");
      }
    }
    void restoreLocalKnowledge();
    return () => { active = false; };
  }, []);

  const visibleGaps = status.informationGaps.slice(0, 6);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请重试。");
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    await run("start", async () => {
      const next = await patchStatus({ action: "start", localKnowledgeCount });
      setStatus(next);
      setActiveStep(firstIncomplete(next));
    });
  }

  async function savePrimaryChannel() {
    await run("channel", async () => {
      const next = await patchStatus({
        action: "sync",
        primaryChannel,
        localKnowledgeCount,
      });
      setStatus(next);
      setMessage(`已将${channelLabels[primaryChannel]}设为主渠道。`);
      setActiveStep("style");
    });
  }

  async function complete() {
    await run("complete", async () => {
      const next = await patchStatus({
        action: "complete",
        primaryChannel,
        localKnowledgeCount,
      });
      setStatus(next);
      router.push("/plans");
      router.refresh();
    });
  }

  async function restart() {
    await run("restart", async () => {
      const next = await patchStatus({
        action: "restart",
        primaryChannel,
        localKnowledgeCount,
      });
      setStatus(next);
      setActiveStep(firstIncomplete(next));
    });
  }

  if (status.state === "not_started") {
    return (
      <SetupFrame>
        <div className="mx-auto max-w-3xl py-12 sm:py-20">
          <p className="text-sm font-semibold text-emerald-800">首次企业建档</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            先把企业资料和内容方向确认清楚
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            系统会复用你已经连接的知识库、账号定位和写作风格。缺什么补什么，不需要重新填写一遍。
          </p>
          <div className="mt-9 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-900">预计需要 10 到 20 分钟</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  资料不完整也可以开始。系统会明确标出缺口，不会替你编造企业事实。
                </p>
              </div>
              <button className={primaryButtonClass} disabled={busy !== null} onClick={start} type="button">
                {busy === "start" ? "正在准备" : "开始建档"}
              </button>
            </div>
          </div>
          {completionCount ? (
            <p className="mt-4 text-sm text-slate-500">已识别到 {completionCount} 项现有资料，进入后会自动带入。</p>
          ) : null}
          {message ? <Message text={message} /> : null}
        </div>
      </SetupFrame>
    );
  }

  if (status.state === "completed") {
    return (
      <SetupFrame>
        <div className="mx-auto max-w-4xl py-10 sm:py-16">
          <span className="inline-flex rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-900">建档已完成</span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {initialData.account?.accountName || "当前企业"}已经可以开始制定内容计划
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            建档完成不代表资料必须完美。后续可以继续补充企业资料、调整定位和升级写作风格。
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <SummaryCard label="当前定位" value={initialData.account?.accountPosition || "待补充"} />
            <SummaryCard label="默认主渠道" value={status.primaryChannel ? channelLabels[status.primaryChannel] : "待确认"} />
            <SummaryCard label="知识资料" value={`${status.knowledgeReadiness === "ready" ? "资料较完整" : status.knowledgeReadiness === "minimum" ? "已有基础资料" : "尚未连接"}，当前浏览器与服务端共识别 ${totalKnowledgeCount} 份`} />
            <SummaryCard label="写作风格" value={initialData.styleProfile?.name || "暂用账号品牌语气"} />
          </div>
          {visibleGaps.length ? <GapPanel gaps={visibleGaps} /> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={primaryButtonClass} href="/plans">进入内容计划</Link>
            <Link className={secondaryButtonClass} href="/knowledge">补充企业资料</Link>
            <Link className={secondaryButtonClass} href="/brand">调整账号与风格</Link>
            <button className={secondaryButtonClass} disabled={busy !== null} onClick={restart} type="button">
              {busy === "restart" ? "正在重新打开" : "重新建档"}
            </button>
          </div>
          {message ? <Message text={message} /> : null}
        </div>
      </SetupFrame>
    );
  }

  return (
    <SetupFrame>
      <div className="py-7 sm:py-10">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold text-emerald-800">企业建档</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">确认生成内容所需的基础信息</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            已完成 {completionCount}/5 项。系统只记录建档进度，企业资料仍保存在原来的账号、知识库和风格模块中。
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <nav aria-label="建档步骤" className="grid content-start gap-2">
            {stepOrder.map((step) => {
              const completed = status.completedSteps.includes(step);
              const selected = step === activeStep;
              return (
                <button
                  aria-current={selected ? "step" : undefined}
                  className={`grid grid-cols-[36px_1fr] items-start gap-3 rounded-2xl border px-4 py-4 text-left transition active:translate-y-px ${
                    selected
                      ? "border-emerald-800 bg-[#e9f0ec]"
                      : "border-slate-200 bg-white hover:border-emerald-800/35"
                  }`}
                  key={step}
                  onClick={() => setActiveStep(step)}
                  type="button"
                >
                  <span className={`grid size-9 place-items-center rounded-xl text-sm font-semibold ${completed ? "bg-[#173e32] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {completed ? "✓" : stepOrder.indexOf(step) + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{stepContent[step].title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{stepContent[step].summary}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="min-h-[480px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <StepPanel
              account={initialData.account}
              activeStep={activeStep}
              localKnowledgeCount={localKnowledgeCount}
              localPermission={localPermission}
              primaryChannel={primaryChannel}
              serverKnowledgeCount={initialData.serverKnowledgeCount}
              setPrimaryChannel={setPrimaryChannel}
              status={status}
              styleName={initialData.styleProfile?.name}
              styleVersion={initialData.styleProfile?.version}
              busy={busy}
              onSavePrimaryChannel={savePrimaryChannel}
            />
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-base font-semibold text-slate-900">资料缺口与生成影响</h2>
              {visibleGaps.length ? (
                <ul className="mt-3 grid gap-2">
                  {visibleGaps.map((gap) => <li className="text-sm leading-6 text-slate-600" key={gap}>{gap}</li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-emerald-800">关键资料已确认，可以生成内容计划。</p>}
            </div>
            <button className={primaryButtonClass} disabled={busy !== null || !canComplete} onClick={complete} type="button">
              {busy === "complete" ? "正在完成建档" : "完成建档并进入计划"}
            </button>
          </div>
          {!canComplete ? <p className="mt-4 text-xs leading-5 text-amber-800">完成建档前，必须确认企业信息、账号定位和主渠道。知识与风格可以稍后补充。</p> : null}
        </div>
        {message ? <Message text={message} /> : null}
      </div>
    </SetupFrame>
  );
}

function StepPanel({
  account,
  activeStep,
  localKnowledgeCount,
  localPermission,
  primaryChannel,
  serverKnowledgeCount,
  setPrimaryChannel,
  status,
  styleName,
  styleVersion,
  busy,
  onSavePrimaryChannel,
}: {
  account: SetupAccountSummary | null;
  activeStep: OnboardingStepId;
  localKnowledgeCount: number;
  localPermission: PermissionState | "none" | "unsupported";
  primaryChannel: ContentChannel;
  serverKnowledgeCount: number;
  setPrimaryChannel: (channel: ContentChannel) => void;
  status: OnboardingStatus;
  styleName?: string;
  styleVersion?: number;
  busy: string | null;
  onSavePrimaryChannel: () => Promise<void>;
}) {
  const completed = status.completedSteps.includes(activeStep);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-emerald-800">{completed ? "已确认" : "待处理"}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{stepContent[activeStep].title}</h2>
        </div>
        <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${completed ? "bg-emerald-100 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          {completed ? "可以使用" : "需要补充"}
        </span>
      </div>

      {activeStep === "knowledge" ? (
        <div className="mt-7">
          <p className="text-sm leading-6 text-slate-600">连接现有知识源，或先提供企业介绍、产品说明、1 到 3 个案例或 FAQ，以及 3 到 5 篇代表内容。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryCard label="当前浏览器本地资料" value={`${localKnowledgeCount} 份${localPermission === "prompt" || localPermission === "denied" ? "，需要重新授权" : ""}`} />
            <SummaryCard label="飞书与服务端资料" value={`${serverKnowledgeCount} 份`} />
          </div>
          {localPermission === "unsupported" ? <p className="mt-4 text-sm text-amber-800">当前浏览器不支持本地文件夹，请使用桌面版 Chrome 或 Edge，或连接飞书资料。</p> : null}
          <Link className={`${primaryButtonClass} mt-6`} href="/knowledge">连接或管理知识库</Link>
        </div>
      ) : null}

      {activeStep === "business" ? (
        <div className="mt-7">
          <p className="text-sm leading-6 text-slate-600">确认企业做什么、服务谁、主要提供什么，以及希望内容帮助实现什么经营目标。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryCard label="企业或账号" value={account?.accountName || "待补充"} />
            <SummaryCard label="主营业务" value={account?.business || "待补充"} />
            <SummaryCard label="核心产品或服务" value={account?.offer || "待补充"} />
            <SummaryCard label="经营目标" value={account?.conversionGoal || "待补充"} />
            <SummaryCard label="目标客户" value={account?.targetAudience.join("、") || "待补充"} />
          </div>
          <Link className={`${primaryButtonClass} mt-6`} href="/positioning">确认企业信息</Link>
        </div>
      ) : null}

      {activeStep === "positioning" ? (
        <div className="mt-7">
          <p className="text-sm leading-6 text-slate-600">账号定位决定长期写给谁、以什么身份出现，以及哪些方向值得持续积累。</p>
          <div className="mt-5 rounded-2xl bg-[#173e32] p-5 text-white">
            <p className="text-xs text-white/55">当前定位</p>
            <p className="mt-3 text-base leading-7 text-white/90">{account?.accountPosition || "尚未确认账号定位"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(account?.contentPillars ?? []).map((pillar) => <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs" key={pillar}>{pillar}</span>)}
            </div>
          </div>
          <Link className={`${primaryButtonClass} mt-6`} href="/positioning">分析或调整定位</Link>
        </div>
      ) : null}

      {activeStep === "primary_channel" ? (
        <div className="mt-7">
          <p className="text-sm leading-6 text-slate-600">先选一个主渠道。日常快速创作默认只生成这一种内容，需要时仍可进入进阶工作台生成多个渠道。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {contentChannels.map((channel) => (
              <label className={`cursor-pointer rounded-2xl border p-4 transition ${primaryChannel === channel ? "border-emerald-800 bg-[#e9f0ec]" : "border-slate-200 hover:border-slate-300"}`} key={channel}>
                <input className="sr-only" checked={primaryChannel === channel} name="primary-channel" onChange={() => setPrimaryChannel(channel)} type="radio" value={channel} />
                <span className="block text-sm font-semibold text-slate-900">{channelLabels[channel]}</span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">{channelDescriptions[channel]}</span>
              </label>
            ))}
          </div>
          <button className={`${primaryButtonClass} mt-6`} disabled={busy !== null} onClick={onSavePrimaryChannel} type="button">
            {busy === "channel" ? "正在保存" : "确认主渠道"}
          </button>
        </div>
      ) : null}

      {activeStep === "style" ? (
        <div className="mt-7">
          <p className="text-sm leading-6 text-slate-600">写作风格需要来自真实代表内容、风格说明或禁用表达。没有历史内容时，可以先使用账号定位中的品牌语气。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryCard label="当前风格档案" value={styleName || "尚未确认"} />
            <SummaryCard label="生效版本" value={styleVersion ? `v${styleVersion}` : "暂用账号品牌语气"} />
          </div>
          <Link className={`${primaryButtonClass} mt-6`} href="/style-profile">建立或调整写作风格</Link>
        </div>
      ) : null}
    </div>
  );
}

function SetupFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#f5f6f3] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-3" href="/setup">
            <span className="grid size-9 place-items-center rounded-xl bg-[#dfb967] text-sm font-bold text-[#12231d]">C</span>
            <span className="text-sm font-semibold tracking-wide text-[#12231d]">内容工厂</span>
          </Link>
          <span className="hidden text-xs text-slate-500 sm:block">企业资料只保存在当前实例和你主动连接的知识源中</span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-sm leading-6 text-slate-800">{value}</p></div>;
}

function GapPanel({ gaps }: { gaps: string[] }) {
  return <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-semibold text-amber-950">仍可继续补充</h2><ul className="mt-3 grid gap-2">{gaps.map((gap) => <li className="text-sm leading-6 text-amber-900" key={gap}>{gap}</li>)}</ul></div>;
}

function Message({ text }: { text: string }) {
  const error = /失败|无效|请先|错误/.test(text);
  return <p aria-live="polite" className={`mt-5 rounded-2xl px-4 py-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`} role={error ? "alert" : "status"}>{text}</p>;
}

async function patchStatus(update: OnboardingUpdate) {
  const response = await fetch("/api/onboarding/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const payload = await response.json() as { status?: OnboardingStatus; error?: string };
  if (!response.ok || !payload.status) throw new Error(payload.error ?? "建档状态更新失败。");
  return payload.status;
}

function firstIncomplete(status: OnboardingStatus) {
  return stepOrder.find((step) => !status.completedSteps.includes(step)) ?? "knowledge";
}

function inferPrimaryChannel(platforms: string[]): ContentChannel {
  for (const platform of platforms) {
    if (platform.includes("小红书")) return "xiaohongshu_note";
    if (platform.includes("朋友圈")) return "moments_post";
    if (/短视频|视频号|抖音/.test(platform)) return "short_video_script";
    if (/公众号|微信文章/.test(platform)) return "wechat_article";
  }
  return "wechat_article";
}
