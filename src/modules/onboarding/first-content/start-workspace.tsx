"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/navigation-link";
import { AppShell, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, type ContentChannel } from "@/modules/content/types";
import type { InterviewState } from "../interview";

export function StartFirstContentWorkspace({ initialState }: { initialState: InterviewState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [answers, setAnswers] = useState({ ...initialState.answers, primaryChannel: initialState.answers.primaryChannel ?? "xiaohongshu_note" as ContentChannel });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(confirm: boolean) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/onboarding/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirm ? "confirm_business" : "save", revision: state.revision, step: 0, answers }),
      });
      const payload = await response.json() as { interview?: InterviewState; error?: string };
      if (!response.ok || !payload.interview) throw new Error(payload.error ?? "保存未完成，请重试。");
      setState(payload.interview);
      if (confirm) router.refresh();
      else setMessage("回答已保存，下次回来可以继续。尚未确认业务或运营方向。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存未完成，请重试。");
      const response = await fetch("/api/onboarding/interview", { cache: "no-store" }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json() as { interview: InterviewState };
        setState(payload.interview);
      }
    } finally { setBusy(false); }
  }

  return <AppShell active="/setup">
    <header>
      <p className="text-sm font-semibold text-emerald-800">先写一篇</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">先介绍真实业务，方向可以慢慢定</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">用下面的信息写公众号或小红书。不需要先上传文件、调研同行或制定计划。</p>
    </header>
    <fieldset className="mt-7 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" disabled={busy}>
      <legend className="sr-only">本篇使用的真实业务信息</legend>
      <div className="grid gap-5">
        {([
          ["accountName", "店铺、企业或个人品牌名称", "填写你对外使用的真实名称", false],
          ["business", "主要做什么业务？", "用平时向客人介绍的方式说就好", false],
          ["offer", "这篇想介绍什么？（可选）", "产品、服务或真实细节；没提供的价格、特点和经历不会补造", true],
        ] as const).map(([id, label, placeholder, optional]) => <label className="block text-sm font-semibold" key={id}>
          {label}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-base font-normal leading-6 focus:border-emerald-800" value={answers[id]} required={!optional} maxLength={id === "accountName" ? 120 : 2000} placeholder={placeholder} onChange={(event) => setAnswers({ ...answers, [id]: event.target.value })} />
        </label>)}
        <label className="block text-sm font-semibold">第一篇发到哪里？
          <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-normal" value={answers.primaryChannel} onChange={(event) => setAnswers({ ...answers, primaryChannel: event.target.value as ContentChannel })}>
            {(["xiaohongshu_note", "wechat_article", "short_video_script", ...(answers.primaryChannel === "moments_post" ? ["moments_post" as const] : [])] as ContentChannel[]).map((channel) => <option key={channel} value={channel}>{channelLabels[channel]}{channel === "short_video_script" ? "（只生成脚本）" : ""}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-500">点击开始后，以上业务信息会保存为你的企业资料。不会确认 AI 的客群、定位或长期方向建议。</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className={primaryButtonClass} type="button" disabled={busy || !answers.accountName.trim() || !answers.business.trim()} onClick={() => void save(true)}>{busy ? "正在保存…" : "确认业务，开始写"}</button>
        <button className={secondaryButtonClass} type="button" onClick={() => void save(false)}>先保存回答</button>
      </div>
    </fieldset>
    {message ? <p className="mt-5 text-sm leading-6 text-amber-900" role="status">{message}</p> : null}
    <nav className="mt-7 flex flex-wrap gap-4 text-sm text-emerald-900"><Link href="/setup/interview">先详细梳理业务与方向</Link><Link href="/articles">查看我的历史内容</Link></nav>
  </AppShell>;
}
