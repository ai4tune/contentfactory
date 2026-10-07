"use client";

import Link from "@/components/navigation-link";
import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { PositioningClient } from "@/app/positioning/positioning-client";
import { StyleProfileWorkspace } from "@/modules/style-profile/components/style-profile-workspace";
import { KnowledgeProfileWorkspace, type ProfileState } from "@/modules/knowledge-profile/components/knowledge-profile-workspace";
import { KnowledgeWorkspace } from "@/modules/knowledge/components/knowledge-workspace";
import { buildStarterStyle, voices } from "@/modules/onboarding/first-content/catalog";
import type { AccountContext } from "@/modules/positioning/types";
import type { AccountCapture } from "@/modules/positioning/capture";
import type { StyleProfile } from "@/modules/style-profile/types";

const steps = [
  { id: "materials", label: "1. 品牌资料与历史" },
  { id: "positioning", label: "2. 当前定位" },
  { id: "style", label: "3. 写作风格" },
] as const;
type BrandStep = typeof steps[number]["id"];

export function BrandClient({ initialContext, initialCapture, initialProfile, initialConfirmedProfile, initialKnowledgeState, initialStep }: {
  initialContext: AccountContext | null; initialCapture: AccountCapture | null;
  initialProfile: StyleProfile | null; initialConfirmedProfile: StyleProfile | null;
  initialKnowledgeState: ProfileState; initialStep?: string;
}) {
  const firstStep = steps.find((step) => step.id === initialStep)?.id ?? "materials";
  const [active, setActive] = useState<BrandStep>(firstStep);
  const [visited, setVisited] = useState<BrandStep[]>([firstStep]);
  const [context, setContext] = useState(initialContext);
  const [knowledge, setKnowledge] = useState(initialKnowledgeState.confirmed);
  const [style, setStyle] = useState(initialConfirmedProfile);
  const [showMaterials, setShowMaterials] = useState(false);

  function select(step: BrandStep) {
    setActive(step); setVisited((items) => items.includes(step) ? items : [...items, step]);
    window.history.replaceState(null, "", `/brand?step=${step}`);
  }
  const options = context?.status === "confirmed" ? voices.map((voice) => ({
    id: voice.id, name: voice.name, sample: buildStarterStyle(context, "general", voice.id).examples[0].excerpt,
  })) : [];

  return <AppShell active="/brand">
    <PageHeader eyebrow="企业资料" title="把自己梳理清楚，再开始写" description="先核对真实资料，再确定今天的经营方向，最后选择表达方式。每一步单独确认；重新分析和看模板不会自动替换当前配置。" actions={<Link className={secondaryButtonClass} href="/setup/interview">聊聊我的生意</Link>} />
    <div className="mt-5 grid gap-3 rounded-2xl bg-emerald-50 p-4 text-sm sm:grid-cols-3">
      <p>品牌资料：{knowledge ? `已确认 v${knowledge.version}` : "可补充，经营访谈也可起步"}</p>
      <p>定位：{context?.status === "confirmed" ? context.accountName : "待确认"}</p>
      <p>风格：{style ? `已确认 v${style.version}` : "待选择或录入"}</p>
    </div>
    <nav className="mt-6 flex flex-wrap gap-3" aria-label="品牌确认步骤">{steps.map((step) => <button className={active === step.id ? primaryButtonClass : secondaryButtonClass} aria-pressed={active === step.id} onClick={() => select(step.id)} key={step.id} type="button">{step.label}</button>)}</nav>

    {visited.includes("materials") ? <section hidden={active !== "materials"}>
      <p className="mt-5 text-sm leading-6 text-slate-600">品牌资料记录实际业务、产品和边界；历史账号用于参考过去的表达，不自动决定未来定位。</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">自己的历史账号</h2>
        {initialCapture ? <><p className="mt-2 text-sm">{initialCapture.accountName} · {initialCapture.platform} · {initialCapture.contents.length} 条已采集内容</p><p className="mt-2 break-all text-xs text-slate-500">采集于 {initialCapture.capturedAt} · {initialCapture.sourceUrl}</p><p className="mt-2 text-sm leading-6 text-slate-600">下一步核对当前经营目标；风格步骤中可以选择含正文的代表文章。只有标题的记录不能用于全文风格分析。</p></> : <p className="mt-2 text-sm text-slate-600">还没有历史采集。可以直接补充品牌资料，或在下一步连接采集插件；没有历史账号也能继续。</p>}
      </div>
      <KnowledgeProfileWorkspace initialState={initialKnowledgeState} bare onConfirmed={setKnowledge} />
      <button className={`${secondaryButtonClass} mt-5`} type="button" onClick={() => setShowMaterials((value) => !value)} aria-expanded={showMaterials}>选择、上传与整理品牌资料</button>
      {showMaterials ? <KnowledgeWorkspace bare /> : null}
      <button className={`${primaryButtonClass} mt-5 ml-3`} type="button" onClick={() => select("positioning")}>下一步：核对当前定位</button>
    </section> : null}
    {visited.includes("positioning") ? <section hidden={active !== "positioning"}>
      <p className="mt-5 text-sm leading-6 text-slate-600">以当前经营目标、产品和人群为主。历史采集只作参考，AI 预览需你核对；确认前现有定位继续生效。</p>
      <PositioningClient initialContext={context} initialCapture={initialCapture} initialKnowledgeProfile={knowledge} bare onConfirmed={setContext} />
      <button className={`${primaryButtonClass} mt-5`} type="button" onClick={() => select("style")}>下一步：确定写作风格</button>
    </section> : null}
    {visited.includes("style") ? <section hidden={active !== "style"} className="mt-6">
      <StyleProfileWorkspace accountName={context?.accountName ?? "当前账号"} initialProfile={initialProfile} initialConfirmedProfile={initialConfirmedProfile} initialCapture={initialCapture} starterOptions={options} bare onConfirmed={setStyle} />
      {context?.status === "confirmed" && style ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><p className="text-sm leading-6">后续创作使用已确认的定位和风格。尚未确认的草稿、历史采集与参考文章不会自动变成品牌事实。</p><Link className={`${primaryButtonClass} mt-4`} href="/setup/first-content">用已确认配置写第一篇</Link></div> : null}
    </section> : null}
    <nav className="mt-7 flex flex-wrap gap-4 text-sm text-emerald-900"><Link href="/knowledge">原知识库入口</Link><Link href="/drafts">我的历史稿件</Link><Link href="/plans">内容计划</Link></nav>
  </AppShell>;
}
