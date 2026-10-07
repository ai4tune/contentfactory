"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/navigation-link";
import { AppShell, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels } from "@/modules/content/types";
import type { StyleProfile } from "@/modules/style-profile/types";
import type { FirstContentSnapshot } from "./service";
import { industries, type IndustryId, type VoiceId } from "./catalog";

export function FirstContentWorkspace({ initialData }: { initialData: FirstContentSnapshot }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [voice, setVoice] = useState<VoiceId>(initialData.draftProfile?.starterTemplate?.voice ?? initialData.confirmedProfile?.starterTemplate?.voice ?? "chat");
  const [adjustments, setAdjustments] = useState(() => (initialData.draftProfile ?? initialData.confirmedProfile)?.rules.filter((rule) => rule.id === "starter-rule-extra").map((rule) => rule.instruction).join("\n") ?? "");
  const [draft, setDraft] = useState(initialData.draftProfile);
  const [ready, setReady] = useState(Boolean(initialData.confirmedProfile) && !initialData.draftProfile);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const industry = industries.find((item) => item.id === data.industry)!;

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key); setMessage(null);
    try { await work(); } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作未完成，请重试。");
    } finally { setBusy(null); }
  }

  async function changeIndustry(value: IndustryId) {
    await run("industry", async () => {
      const response = await fetch(`/api/onboarding/first-content?industry=${value}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload); setDraft(null); setReady(false);
    });
  }

  async function preview() {
    await run("preview", async () => {
      const payload = await post({ action: "preview_style", industry: data.industry, voice, adjustments, version: data.profileVersion }) as { profile: StyleProfile };
      setDraft(payload.profile); setReady(false);
      setData({ ...data, profileVersion: payload.profile.version });
    });
  }

  async function confirm() {
    if (!draft) return;
    await run("confirm", async () => {
      const payload = await post({ action: "confirm_style", version: draft.version }) as { profile: StyleProfile };
      setData({ ...data, profileVersion: payload.profile.version, confirmedProfile: payload.profile, draftProfile: null });
      setDraft(null); setReady(true); setMessage("口吻已确认，可以选一篇开始写。以后仍可继续补充资料和调整风格。");
    });
  }

  async function generate(topicId: string) {
    await run(topicId, async () => {
      const payload = await post({ action: "generate", topicId, version: data.confirmedProfile?.version }) as { project: { id: string } };
      router.push(`/drafts/${encodeURIComponent(payload.project.id)}`);
    });
  }

  return (
    <AppShell active="/setup">
      <header>
        <p className="text-sm font-semibold text-emerald-800">{data.accountName} · 写第一篇</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">先选口吻，再选一篇</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">下面三个示例使用同一组已确认信息。选择你喜欢的表达，之后可以继续补充品牌资料和代表文章。</p>
      </header>
      <fieldset className="mt-7 min-w-0" disabled={busy !== null}>
        <legend className="sr-only">选择行业、口吻和第一篇选题</legend>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <label className="text-sm font-semibold" htmlFor="starter-industry">我的业务类型</label>
          <select id="starter-industry" className="ml-0 mt-2 block w-full rounded-xl border border-slate-300 p-3 text-base sm:max-w-sm" value={data.industry} onChange={(event) => void changeIndustry(event.target.value as IndustryId)}>
            {industries.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <p className="mt-3 text-sm leading-6 text-slate-500">初始方向：{industry.directions.join("、")}。后续可补：{industry.needed}。</p>
          {data.confirmedProfile ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            已确认：{data.confirmedProfile.name} v{data.confirmedProfile.version}。重新选例稿和保存预览不会改变当前口吻。
            {!ready ? <button className="mt-2 block font-semibold underline underline-offset-4" type="button" onClick={() => { setReady(true); setDraft(null); }}>这篇沿用已确认口吻</button> : null}
          </div> : null}
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {data.options.map((option) => <label key={option.id} className={`min-w-0 cursor-pointer rounded-xl border p-4 ${voice === option.id ? "border-emerald-800 bg-emerald-50/50" : "border-slate-200"}`}>
              <span className="flex items-center gap-2 font-semibold"><input type="radio" name="starter-voice" value={option.id} checked={voice === option.id} onChange={() => { setVoice(option.id); setReady(false); setDraft(null); }} />{option.name}</span>
              <span className="mt-3 block whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{option.sample}</span>
            </label>)}
          </div>
          <label className="mt-5 block text-sm font-semibold" htmlFor="starter-adjustments">再补一句你的偏好（可选）</label>
          <textarea id="starter-adjustments" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base" rows={2} maxLength={500} value={adjustments} placeholder="例如：更口语一点，少用感叹号，不要每次都邀请到店" onChange={(event) => { setAdjustments(event.target.value); setReady(false); setDraft(null); }} />
          <p className="mt-2 text-xs leading-5 text-slate-500">补充要求会用于后续成稿，例稿展示基础口吻。产品事实和个人经历请在品牌资料中补充。</p>
          <button className={`${secondaryButtonClass} mt-4`} type="button" onClick={() => void preview()}>{busy === "preview" ? "正在保存…" : "保存口吻预览"}</button>
          {draft ? <div className="mt-5 rounded-xl border border-emerald-200 p-4">
            <p className="font-semibold">核对口吻：{draft.name}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{draft.examples[0]?.excerpt}</p>
            <ul className="mt-3 list-disc pl-5 text-sm leading-6">{draft.rules.map((rule) => <li key={rule.id}>{rule.instruction}</li>)}</ul>
            <button className={`${primaryButtonClass} mt-4`} type="button" onClick={() => void confirm()}>{busy === "confirm" ? "正在确认…" : "确认口吻，开始选题"}</button>
          </div> : null}
        </section>
        <section className="mt-6">
          <h2 className="text-xl font-semibold">先写哪一篇？</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">默认写{channelLabels[data.channel]}。先完成一篇，再决定是否安排完整内容计划。</p>
          <div className="mt-4 grid gap-4">
            {data.topics.map((topic) => <article key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">{topic.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{topic.reason}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">写给：{topic.audience || "希望了解这项业务的人（待验证）"}<br />资料：{topic.needs}</p>
              {topic.projectId ? <Link className={`${primaryButtonClass} mt-4`} href={`/drafts/${encodeURIComponent(topic.projectId)}`}>继续这篇草稿</Link> : <button className={`${primaryButtonClass} mt-4`} type="button" disabled={!ready || busy !== null} onClick={() => void generate(topic.id)}>{busy === topic.id ? "正在写作并核对资料…" : "就写这一篇"}</button>}
            </article>)}
          </div>
          {!ready ? <p className="mt-3 text-sm text-amber-800">先确认口吻，或沿用已有风格，再开始创作。</p> : null}
        </section>
      </fieldset>
      {message ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">{message}</p> : null}
      <nav className="mt-7 flex flex-wrap gap-4 text-sm text-emerald-900"><Link href="/brand">补充品牌与历史内容</Link><Link href="/knowledge">补充产品资料</Link><Link href="/drafts">找回我的草稿</Link><Link href="/plans">完整内容计划</Link></nav>
    </AppShell>
  );
}

async function post(body: unknown) {
  const response = await fetch("/api/onboarding/first-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "操作未完成，请重试。");
  return payload;
}
