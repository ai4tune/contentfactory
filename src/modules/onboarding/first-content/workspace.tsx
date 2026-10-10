"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/navigation-link";
import { AppShell, primaryButtonClass } from "@/components/app-shell";
import { channelLabels, type ContentChannel } from "@/modules/content/types";
import type { StyleProfile } from "@/modules/style-profile/types";
import type { FirstContentSnapshot } from "./service";
import { starterGuidance } from "./catalog";
import { StarterStylePicker } from "@/modules/style-profile/components/starter-style-picker";

export function FirstContentWorkspace({ initialData, initialTopic = "" }: { initialData: FirstContentSnapshot; initialTopic?: string }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState(initialData.draftProfile);
  const [ready, setReady] = useState(!initialData.draftProfile);
  const [ownTopic, setOwnTopic] = useState(initialTopic);
  const [channel, setChannel] = useState(initialData.channel);
  const [temporaryStyle, setTemporaryStyle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key); setMessage(null);
    try { await work(); } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作未完成，请重试。");
    } finally { setBusy(null); }
  }

  async function confirm() {
    if (!draft) return;
    await run("confirm", async () => {
      const payload = await post({ action: "confirm_style", version: draft.version }) as { profile: StyleProfile };
      setData({ ...data, profileVersion: payload.profile.version, confirmedProfile: payload.profile, draftProfile: null });
      setDraft(null); setReady(true); setMessage("口吻已确认，可以选一篇开始写。以后仍可继续补充资料和调整风格。");
    });
  }

  async function generate(topicId: string, topic?: string) {
    await run(topicId, async () => {
      const payload = await post({ action: "generate", topicId, topic, channel, version: data.confirmedProfile?.version ?? 0, useDefaultStyle: !data.confirmedProfile, temporaryStyleInstructions: temporaryStyle.split("\n").map((line) => line.trim()).filter(Boolean) }) as { project: { id: string } };
      router.push(`/drafts/${encodeURIComponent(payload.project.id)}`);
    });
  }

  return (
    <AppShell active="/setup">
      <header>
        <p className="text-sm font-semibold text-emerald-800">{data.accountName} · 写第一篇</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">先完成一篇，口吻可以再调整</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">写自己的想法，或选一个基于真实业务的建议。不需要先制定内容计划。</p>
        {!data.positioningConfirmed ? <p className="mt-3 text-sm leading-6 text-amber-800">经营信息已确认；长期定位和客群方向尚未确认，可以写完这篇再梳理。</p> : null}
      </header>
      <fieldset className="mt-7 min-w-0" disabled={busy !== null}>
        <legend className="sr-only">选择口吻和第一篇选题</legend>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <p className="text-sm font-semibold">你的业务：{data.business}</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">可以先写：{starterGuidance.directions.join("、")}。后续可补：{starterGuidance.needed}。</p>
          {data.confirmedProfile ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            已确认：{data.confirmedProfile.name} v{data.confirmedProfile.version}。重新选例稿和保存预览不会改变当前口吻。
            {!ready ? <button className="mt-2 block font-semibold underline underline-offset-4" type="button" onClick={() => { setReady(true); setDraft(null); }}>这篇沿用已确认口吻</button> : null}
          </div> : null}
          {!data.confirmedProfile ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            可以先用自然、清楚的表达写一篇。下面的口吻选择是可选的，保存预览后需要你确认才会长期生效。
            {!ready ? <button className="mt-2 block font-semibold underline underline-offset-4" type="button" onClick={() => { setReady(true); setDraft(null); }}>这篇先用自然表达</button> : null}
          </div> : null}
          <nav className="mt-4 flex flex-wrap gap-4 text-sm text-emerald-900"><Link href="/brand?step=style">已有风格？手动录入或分析自己的文章</Link><Link href="/brand">核对品牌资料、历史参考与定位</Link></nav>
          <details className="mt-5" open={Boolean(draft)}><summary className="cursor-pointer text-sm font-semibold text-emerald-900">选择以后默认的口吻（可选）</summary><StarterStylePicker key={data.profileVersion} options={data.options} version={data.profileVersion} current={draft ?? data.confirmedProfile} confirmed={data.confirmedProfile} onSaved={(saved) => { setDraft(saved); setReady(false); setData({ ...data, profileVersion: saved.version }); }} /></details>
          {draft ? <div className="mt-5 rounded-xl border border-emerald-200 p-4">
            <p className="font-semibold">核对口吻：{draft.name}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{draft.examples[0]?.excerpt}</p>
            <ul className="mt-3 list-disc pl-5 text-sm leading-6">{draft.rules.map((rule) => <li key={rule.id}>{rule.instruction}</li>)}</ul>
            <button className={`${primaryButtonClass} mt-4`} type="button" onClick={() => void confirm()}>{busy === "confirm" ? "正在确认…" : "确认口吻，开始选题"}</button>
          </div> : null}
        </section>
        <section className="mt-6">
          <h2 className="text-xl font-semibold">先写哪一篇？</h2>
          <label className="mt-3 block text-sm font-semibold">仅这篇的表达要求（可选）<textarea className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base font-normal" rows={2} maxLength={500} value={temporaryStyle} placeholder="例如：更口语一点，少用感叹号。不改变以后默认的写法。" onChange={(event) => setTemporaryStyle(event.target.value)} /></label>
          <label className="mt-3 block text-sm font-semibold">本篇内容形式
            <select className="mt-2 w-full max-w-md rounded-xl border border-slate-300 bg-white p-3 text-base font-normal" value={channel} onChange={(event) => setChannel(event.target.value as ContentChannel)}>
              {(["xiaohongshu_note", "wechat_article", "short_video_script", ...(data.channel === "moments_post" ? ["moments_post" as const] : [])] as ContentChannel[]).map((item) => <option key={item} value={item}>{channelLabels[item]}{item === "short_video_script" ? "（只生成脚本）" : ""}</option>)}
            </select>
          </label>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <label className="block font-semibold" htmlFor="own-topic">我有自己的选题</label>
            <textarea id="own-topic" className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-base leading-6" value={ownTopic} maxLength={200} placeholder="说说这篇想介绍什么；只写已提供的真实信息" onChange={(event) => setOwnTopic(event.target.value)} />
            <button className={`${primaryButtonClass} mt-4`} type="button" disabled={!ready || !ownTopic.trim()} onClick={() => void generate("own", ownTopic.trim())}>{busy === "own" ? "正在写作并核对资料…" : "就写这个想法"}</button>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">也可以从下面的建议开始。建议来自已确认业务，还没有进行同行调研。</p>
          <div className="mt-4 grid gap-4">
            {data.topics.map((topic) => <article key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">{topic.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{topic.reason}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">写给：{topic.audience || "希望了解这项业务的人（待验证）"}<br />资料：{topic.needs}</p>
              {topic.projectId && channel === data.channel ? <Link className={`${primaryButtonClass} mt-4`} href={`/drafts/${encodeURIComponent(topic.projectId)}`}>继续这篇草稿</Link> : <button className={`${primaryButtonClass} mt-4`} type="button" disabled={!ready || busy !== null} onClick={() => void generate(topic.id)}>{busy === topic.id ? "正在写作并核对资料…" : "就写这一篇"}</button>}
            </article>)}
          </div>
          {!ready ? <p className="mt-3 text-sm text-amber-800">确认新口吻，或选择这篇沿用原有表达，再开始创作。</p> : null}
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
