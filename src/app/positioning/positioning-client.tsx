"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { PositioningRequest } from "@/lib/ai";
import type { AccountContext, AccountContextDraft } from "@/modules/positioning/types";
import type { AccountCapture, CaptureMetricValue } from "@/modules/positioning/capture";

const emptyForm: PositioningRequest = {
  accountName: "",
  business: "",
  audience: "",
  offer: "",
  differentiator: "",
  platforms: "小红书、公众号、朋友圈、短视频",
  goal: "获客、信任建设、成交转化",
  currentContent: "",
};

export function PositioningClient({
  initialContext,
  initialCapture,
  extensionPath,
}: {
  initialContext: AccountContext | null;
  initialCapture: AccountCapture | null;
  extensionPath: string;
}) {
  const router = useRouter();
  const [context, setContext] = useState(initialContext);
  const [editing, setEditing] = useState(initialContext?.status !== "confirmed");
  const [form, setForm] = useState<PositioningRequest>(() => formFromContext(initialContext));
  const [draft, setDraft] = useState<AccountContextDraft | null>(null);
  const [busy, setBusy] = useState<"analyze" | "confirm" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy("analyze");
    setError(null);
    try {
      const response = await fetch("/api/positioning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { draft?: AccountContextDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error ?? "定位分析失败");
      setDraft(payload.draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "定位分析失败");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!draft) return;
    setBusy("confirm");
    setError(null);
    try {
      const response = await fetch("/api/positioning/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", draft }),
      });
      const payload = (await response.json()) as { context?: AccountContext; error?: string };
      if (!response.ok || !payload.context) throw new Error(payload.error ?? "定位保存失败");
      setContext(payload.context);
      setDraft(null);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "定位保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    setBusy("skip");
    setError(null);
    try {
      const response = await fetch("/api/positioning/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      const payload = (await response.json()) as { context?: AccountContext; error?: string };
      if (!response.ok || !payload.context) throw new Error(payload.error ?? "暂时跳过失败");
      setContext(payload.context);
      router.push("/workbench");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时跳过失败");
      setBusy(null);
    }
  }

  if (context?.status === "confirmed" && !editing) {
    return (
      <AppShell active="/positioning">
        <PageHeader eyebrow="CURRENT ACCOUNT" title="当前账号" description="这份已确认的账号上下文会自动进入选题、简报和内容生成。" actions={<button className={secondaryButtonClass} onClick={() => setEditing(true)}>更新定位</button>} />
        <CaptureExtensionCard capture={initialCapture} extensionPath={extensionPath} onRefresh={() => router.refresh()} />
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl bg-[#173e32] p-6 text-white shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#dfb967] px-3 py-1 text-xs font-semibold text-[#173e32]">已确认 · 当前唯一账号</span><span className="text-xs text-white/50">更新于 {formatDate(context.updatedAt)}</span></div>
            <h2 className="mt-7 text-2xl font-semibold">{context.accountName || "未命名账号"}</h2>
            <p className="mt-4 text-lg leading-8 text-white/85">{context.accountPosition}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3"><Stat label="目标客户" value={context.targetAudience.join("、")} /><Stat label="核心产品" value={context.offer} /><Stat label="主要平台" value={context.platforms.join("、")} /></div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><ResultGroup title="品牌语气" items={context.brandVoice} tags /><ResultGroup title="禁用表达" items={context.bannedPhrases} tags /><Link className={`${primaryButtonClass} mt-6`} href="/workbench">带着当前定位去创作 →</Link></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2"><div className="grid gap-7 lg:grid-cols-2"><ResultGroup title="内容支柱" items={context.contentPillars} /><ResultGroup title="常用表达" items={context.preferredPhrases} tags /><ResultGroup title="下一阶段内容方向" items={context.contentDirections} /><ResultGroup title="推荐首批选题" items={context.recommendedTopics} /><ResultGroup title="分析依据" items={context.analysisEvidence} /><ResultGroup title="待补信息" items={context.informationGaps} /></div></section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="/positioning">
      <PageHeader eyebrow="QUICK POSITIONING" title={draft ? "确认账号定位" : "快速建立当前账号"} description={draft ? "AI 结果还没有生效。你可以直接修改，确认后才会覆盖当前账号。" : "只填写关键业务信息即可；也可以先跳过，账号定位不会阻止创作。"} />
      {!draft ? <CaptureExtensionCard capture={initialCapture} extensionPath={extensionPath} onRefresh={() => router.refresh()} /> : null}
      {context?.status === "skipped" && !draft ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">你上次选择了暂时跳过。现在可以补充定位，也可以继续直接创作。</div> : null}
      {draft ? <DraftEditor draft={draft} onChange={setDraft} /> : <PositioningForm form={form} onChange={setForm} />}
      {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {draft ? <><button className={primaryButtonClass} disabled={Boolean(busy)} onClick={confirm}>{busy === "confirm" ? "正在保存…" : "确认并设为当前账号"}</button><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => setDraft(null)}>返回修改资料</button></> : <><button className={primaryButtonClass} disabled={Boolean(busy)} onClick={analyze}>{busy === "analyze" ? "AI 正在分析…" : "生成定位预览"}</button>{context?.status === "confirmed" ? <button className={secondaryButtonClass} onClick={() => setEditing(false)}>取消</button> : <button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={skip}>{busy === "skip" ? "正在跳过…" : "先跳过，直接创作"}</button>}</>}
      </div>
    </AppShell>
  );
}

function CaptureExtensionCard({
  capture,
  extensionPath,
  onRefresh,
}: {
  capture: AccountCapture | null;
  extensionPath: string;
  onRefresh: () => void;
}) {
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function detectFromPage() {
      const version = document.documentElement.dataset.contentFactoryCaptureVersion;
      if (version) setExtensionVersion(version);
    }
    function handleMessage(event: MessageEvent) {
      if (
        event.source === window
        && event.data?.source === "contentfactory-capture-extension"
        && event.data?.type === "ready"
      ) {
        setExtensionVersion(String(event.data.version || "已连接"));
      }
    }
    detectFromPage();
    window.addEventListener("message", handleMessage);
    window.postMessage(
      { source: "contentfactory-positioning-page", type: "probe" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(extensionPath);
      setCopied(true);
    } catch {
      const input = document.createElement("textarea");
      input.value = extensionPath;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      setCopied(document.execCommand("copy"));
      input.remove();
    }
    window.setTimeout(() => setCopied(false), 1_500);
  }

  const metrics: Array<[string, CaptureMetricValue | null | undefined]> = [
    ["关注", capture?.accountMetrics.following],
    ["粉丝", capture?.accountMetrics.followers],
    ["获赞与收藏", capture?.accountMetrics.likesAndCollects],
  ];

  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,#f2faf6_0%,#fffdf7_100%)] shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.9fr] lg:p-7">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-800">XIAOHONGSHU CAPTURE</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${extensionVersion ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              {extensionVersion ? `插件已连接 · v${extensionVersion}` : "未检测到插件"}
            </span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-950">从你的小红书账号一键建立定位</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">登录小红书后，扩展会读取当前账号页公开可见的简介、关注、粉丝、获赞收藏和作品表现。你确认 AI 定位后，才会覆盖这里的当前账号。</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className={primaryButtonClass} href="https://www.xiaohongshu.com/explore" target="_blank" rel="noreferrer">打开并登录小红书 →</a>
            <button className={secondaryButtonClass} type="button" onClick={copyPath}>{copied ? "插件目录已复制" : "复制本地插件目录"}</button>
            <button className={secondaryButtonClass} type="button" onClick={onRefresh}>刷新采集结果</button>
          </div>
          {!extensionVersion ? <p className="mt-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-xs leading-5 text-amber-900">首次使用：打开 <code>chrome://extensions</code>，开启开发者模式，选择“加载已解压的扩展程序”，粘贴刚复制的目录。已经安装过时，请点击扩展卡片上的“重新加载”，然后刷新本页。</p> : null}
          {!extensionVersion ? <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-emerald-200">{extensionPath}</code> : null}
        </div>
        <ol className="grid gap-3 text-sm text-slate-700">
          <CaptureStep number="1" title="登录账号" detail="打开小红书，登录后点击左侧“我”，进入自己的账号主页。" />
          <CaptureStep number="2" title="采集当前页面" detail="点击 Chrome 右上角的“内容工厂账号采集助手”，再点击“采集当前页面”。" />
          <CaptureStep number="3" title="确认 AI 定位" detail="核对账号与作品指标，生成定位预览；修改确认后回到本页刷新。" />
        </ol>
      </div>
      <div className="border-t border-emerald-100 bg-white/75 px-6 py-5 lg:px-7">
        {capture ? <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          <div><p className="text-xs text-slate-400">最近采集</p><p className="mt-1 text-sm font-semibold text-slate-800">{capture.accountName || "未命名账号"} · {formatDateTime(capture.capturedAt)}</p></div>
          {metrics.map(([label, value]) => <CaptureMetric key={label} label={label} value={value} />)}
          <div><p className="text-xs text-slate-400">可见作品</p><p className="mt-1 text-sm font-semibold text-slate-800">{capture.contents.length} 篇</p></div>
        </div> : <p className="text-sm text-slate-500">还没有采集记录。完成上方三步后，这里会显示账号基础指标和作品数量。</p>}
      </div>
    </section>
  );
}

function CaptureStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="flex gap-3 rounded-2xl border border-white bg-white/75 p-4"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#173e32] text-xs font-semibold text-white">{number}</span><div><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></li>;
}

function CaptureMetric({ label, value }: { label: string; value: CaptureMetricValue | null | undefined }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value?.raw || "未公开"}</p></div>;
}

function PositioningForm({ form, onChange }: { form: PositioningRequest; onChange: (form: PositioningRequest) => void }) {
  return <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><Field label="账号/品牌名" value={form.accountName} onChange={(accountName) => onChange({ ...form, accountName })} placeholder="例如：某某建材" /><Field label="业务类型" required value={form.business} onChange={(business) => onChange({ ...form, business })} placeholder="例如：本地建材门店" /><Field label="目标客户" required value={form.audience} onChange={(audience) => onChange({ ...form, audience })} placeholder="例如：准备装修的本地业主" /><Field label="产品/服务" required value={form.offer} onChange={(offer) => onChange({ ...form, offer })} placeholder="例如：地板和安装服务" /><Field label="主要平台" value={form.platforms || ""} onChange={(platforms) => onChange({ ...form, platforms })} placeholder="小红书、公众号、朋友圈、短视频" /><Field label="内容目标" value={form.goal || ""} onChange={(goal) => onChange({ ...form, goal })} placeholder="获客、信任建设、成交转化" /></div><div className="mt-4 grid gap-4"><TextArea label="差异化优势" value={form.differentiator || ""} onChange={(differentiator) => onChange({ ...form, differentiator })} placeholder="真实案例、服务能力、经验和交付保障" rows={3} /><TextArea label="现有内容或账号采集结果" value={form.currentContent || ""} onChange={(currentContent) => onChange({ ...form, currentContent })} placeholder="可选：粘贴账号简介、代表内容、表现摘要和已知问题" rows={6} /></div></section>;
}

function DraftEditor({ draft, onChange }: { draft: AccountContextDraft; onChange: (draft: AccountContextDraft) => void }) {
  return <section className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><TextArea label="账号定位" value={draft.accountPosition} onChange={(accountPosition) => onChange({ ...draft, accountPosition })} placeholder="账号定位" rows={5} /><div className="mt-4"><ListField label="目标客户" value={draft.targetAudience} onChange={(targetAudience) => onChange({ ...draft, targetAudience })} /></div><div className="mt-4"><ListField label="内容支柱" value={draft.contentPillars} onChange={(contentPillars) => onChange({ ...draft, contentPillars })} /></div><div className="mt-4"><ListField label="品牌语气" value={draft.brandVoice} onChange={(brandVoice) => onChange({ ...draft, brandVoice })} /></div></div><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><ListField label="常用表达" value={draft.preferredPhrases} onChange={(preferredPhrases) => onChange({ ...draft, preferredPhrases })} /><div className="mt-4"><ListField label="禁用表达" value={draft.bannedPhrases} onChange={(bannedPhrases) => onChange({ ...draft, bannedPhrases })} /></div><div className="mt-4"><ListField label="内容方向" value={draft.contentDirections} onChange={(contentDirections) => onChange({ ...draft, contentDirections })} /></div><div className="mt-4"><ListField label="推荐选题" value={draft.recommendedTopics} onChange={(recommendedTopics) => onChange({ ...draft, recommendedTopics })} /></div></div></section>;
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}{required ? <span className="text-rose-600"> *</span> : null}</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function TextArea({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows: number }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span><textarea className="resize-none rounded-xl border border-slate-200 px-3 py-3 leading-6 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} /></label>; }
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) { return <TextArea label={`${label}（每行一项）`} value={value.join("\n")} onChange={(text) => onChange(text.split("\n").map((item) => item.trim()).filter(Boolean))} placeholder={`填写${label}`} rows={4} />; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/8 p-4"><p className="text-xs text-white/45">{label}</p><p className="mt-2 text-sm leading-6 text-white/85">{value || "待补充"}</p></div>; }
function ResultGroup({ title, items, tags }: { title: string; items: string[]; tags?: boolean }) { return <div className="mt-5 first:mt-0"><h3 className="text-sm font-semibold">{title}</h3>{items.length ? tags ? <div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">{item}</span>)}</div> : <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#dfb967]" />{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">待补充</p>}</div>; }

function formFromContext(context: AccountContext | null): PositioningRequest {
  if (!context) return emptyForm;
  return { accountName: context.accountName, business: context.business, audience: context.targetAudience.join("、"), offer: context.offer, differentiator: context.preferredPhrases.join("、"), platforms: context.platforms.join("、"), goal: context.conversionGoal, currentContent: "" };
}
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
