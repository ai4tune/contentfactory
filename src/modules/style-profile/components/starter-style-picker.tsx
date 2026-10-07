"use client";

import { useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { starterVersion, type VoiceId, type styleDifferences } from "@/modules/onboarding/first-content/catalog";
import type { StyleProfile, StyleProfileInput } from "../types";

export type StarterOption = { id: VoiceId; name: string; sample: string };
type Comparison = { profile: StyleProfileInput; differences: ReturnType<typeof styleDifferences> };

export function StarterStylePicker({ options, current, confirmed, version = current?.version ?? 0, onSaved }: {
  version?: number; options: StarterOption[]; current: StyleProfile | null; confirmed: StyleProfile | null;
  onSaved: (profile: StyleProfile) => void;
}) {
  const [voice, setVoice] = useState<VoiceId>(current?.starterTemplate?.voice ?? "chat");
  const [adjustments, setAdjustments] = useState(current?.rules.find((rule) => rule.id === "starter-rule-extra")?.instruction ?? "");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasUpdate = confirmed?.starterTemplate && confirmed.starterTemplate.version < starterVersion;

  async function request(action: "compare_style" | "preview_style") {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/onboarding/first-content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, voice, adjustments, version }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "口吻预览失败。");
      if (action === "compare_style") setComparison(payload);
      else { onSaved(payload.profile); setComparison(null); setMessage("已保存为待确认草稿，当前生效风格没有变化。请核对后再确认。"); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "口吻预览失败。"); }
    finally { setBusy(false); }
  }

  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold">从口吻模板开始</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">示例使用你已确认的业务信息。先查看差异，再决定是否保存；确认后才用于创作。</p>
    {hasUpdate ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">有新版口吻模板 v{starterVersion}。你目前采用 v{confirmed.starterTemplate!.version}，可以继续使用原版本，也可以查看差异后选择更新。</p> : null}
    <fieldset disabled={busy} className="mt-4 min-w-0">
      <legend className="sr-only">选择写作口吻</legend>
      <div className="grid gap-3 lg:grid-cols-3">{options.map((option) => <label key={option.id} className={`min-w-0 cursor-pointer rounded-xl border p-4 ${voice === option.id ? "border-emerald-800 bg-emerald-50" : "border-slate-200"}`}>
        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="starter-voice" checked={voice === option.id} onChange={() => { setVoice(option.id); setComparison(null); }} />{option.name}</span>
        <span className="mt-3 block whitespace-pre-wrap break-words text-sm leading-6">{option.sample}</span>
      </label>)}</div>
      <label className="mt-4 block text-sm font-semibold">补充你的偏好（可选）<textarea className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base" rows={2} maxLength={500} value={adjustments} placeholder="例如：更口语一点，少用感叹号" onChange={(event) => { setAdjustments(event.target.value); setComparison(null); }} /></label>
      <button className={`${secondaryButtonClass} mt-4`} type="button" onClick={() => void request("compare_style")}>{busy ? "正在处理…" : "查看模板与当前风格的差异"}</button>
      {comparison ? <div className="mt-5 rounded-xl border border-emerald-200 p-4">
        <h3 className="font-semibold">更新前核对</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">保留你的身份视角、补充规则、常用词、禁用词和渠道偏好。此预览尚未保存。{current?.status === "draft" ? "保存后会更新待确认草稿，已确认风格保持不变。" : ""}</p>
        {comparison.differences.length ? comparison.differences.map((field) => <div className="mt-4" key={field.label}>
          <h4 className="text-sm font-semibold">{field.label}</h4>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">当前生效</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{field.before.join("\n") || "尚未设置"}</p></div>
            <div className="min-w-0 rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-800">采用后</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{field.after.join("\n")}</p></div>
          </div>
        </div>) : <p className="mt-3 text-sm">表达内容没有变化。</p>}
        <div className="mt-4 flex flex-wrap gap-3"><button className={primaryButtonClass} type="button" onClick={() => void request("preview_style")}>保存此模板为草稿</button><button className={secondaryButtonClass} type="button" onClick={() => setComparison(null)}>保留当前风格</button></div>
      </div> : null}
    </fieldset>
    {message ? <p className="mt-4 text-sm leading-6 text-amber-900" role="status">{message}</p> : null}
  </section>;
}
