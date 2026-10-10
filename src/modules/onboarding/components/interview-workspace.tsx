"use client";

import Link from "@/components/navigation-link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, contentChannels } from "@/modules/content/types";
import type { InterviewField, InterviewState } from "../interview";
import { interviewAnswersMatch } from "../interview";

const questions: Array<{ title: string; description: string; fields: Array<{ id: InterviewField; label: string; placeholder: string; optional?: boolean }> }> = [
  { title: "先认识一下你的生意", description: "用平时向客人介绍的方式说就好。", fields: [
    { id: "accountName", label: "店铺、企业或个人品牌叫什么？", placeholder: "填写你对外使用的名称" },
    { id: "business", label: "你主要做什么生意？", placeholder: "用一句话说明你提供什么产品、服务或内容" },
  ] },
  { title: "这次最想让内容帮你解决什么？", description: "先选一个近期目标，不用一次想清楚所有事情。", fields: [
    { id: "goal", label: "最近最想改善什么？", placeholder: "例如：收到更多咨询，或让已有客户了解新产品" },
  ] },
  { title: "先宣传哪一件事？", description: "可以是一款产品、一项服务，也可以是最近想让客人知道的事情。", fields: [
    { id: "offer", label: "这周最想宣传什么？", placeholder: "写一个具体产品或服务；有已确认的价格和活动可以一起写" },
  ] },
  { title: "客人为什么来找你？", description: "说说你见过的客人和真实细节。不清楚也没关系。", fields: [
    { id: "audience", label: "客人一般在什么情况下来？", placeholder: "描述客户的真实需求或使用场景；不知道也可以留空", optional: true },
    { id: "differentiator", label: "有什么真实特点值得让客人知道？", placeholder: "例如：一项具体服务、产品特点或你做生意的习惯", optional: true },
  ] },
  { title: "你希望怎么跟客人说话？", description: "不用定义写作风格，把你的偏好告诉我们就行。", fields: [
    { id: "tone", label: "想要什么样的口吻？", placeholder: "例如：像老板聊天，别太正式，也别太像广告", optional: true },
    { id: "boundaries", label: "有什么不能写、或你不想说的话？", placeholder: "例如：不承诺最低价，不宣传还没确定的活动", optional: true },
  ] },
  { title: "第一篇准备发到哪里？", description: "先选一个渠道。以后需要时再扩展。", fields: [] },
];

export function InterviewWorkspace({ initialState }: { initialState: InterviewState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [answers, setAnswers] = useState(initialState.answers);
  const [step, setStep] = useState(initialState.step);
  const [showPreview, setShowPreview] = useState(Boolean(initialState.preview));
  const [position, setPosition] = useState(initialState.preview?.account.accountPosition ?? "");
  const [audience, setAudience] = useState(initialState.preview?.account.targetAudience.join("\n") ?? "");
  const [pillars, setPillars] = useState(initialState.preview?.account.contentPillars.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const question = questions[step];
  const complete = Boolean(state.preview?.confirmedAt && showPreview);

  async function submit(action: "save" | "preview" | "confirm", nextStep = step, exitAfterSave = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/onboarding/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: state.revision, step: nextStep, answers,
          previewId: state.preview?.id,
          edits: { accountPosition: position, targetAudience: lines(audience), contentPillars: lines(pillars) },
        }),
      });
      const payload = await response.json() as { interview?: InterviewState; error?: string };
      if (!response.ok && payload.interview && interviewAnswersMatch(payload.interview.answers, answers)) {
        setState(payload.interview);
        if (action === "preview") setShowPreview(false);
      }
      if (!response.ok || !payload.interview) throw new Error(payload.error ?? "保存失败，请重试。");
      const next = payload.interview;
      setState(next);
      setStep(next.step);
      if (action === "preview" && next.preview) {
        setPosition(next.preview.account.accountPosition);
        setAudience(next.preview.account.targetAudience.join("\n"));
        setPillars(next.preview.account.contentPillars.join("\n"));
        setShowPreview(true);
      } else if (action === "save") {
        setShowPreview(false);
        if (exitAfterSave) router.push("/setup");
        else setMessage("回答已保存，可以稍后回来继续。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理失败，请重试。");
      // 预览前先保存回答；AI 失败后恢复服务端版本，允许原地重试。
      try {
        const response = await fetch("/api/onboarding/interview", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as { interview: InterviewState };
          if (interviewAnswersMatch(payload.interview.answers, answers)
            && (action !== "confirm" || payload.interview.preview?.id === state.preview?.id)) {
            setState(payload.interview);
            if (action === "preview") setShowPreview(false);
          }
        }
      } catch { /* 保留输入，待用户刷新或重试。 */ }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-7 text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link className="text-sm font-semibold text-emerald-800" href="/setup">AI 内容工厂</Link>
        <p className="mt-7 text-sm text-emerald-800">{complete ? "经营信息已确认" : showPreview ? "最后核对一下" : `聊聊你的生意 · ${step + 1}/${questions.length}`}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{complete ? "可以开始写第一篇了" : showPreview ? "这些信息符合你的想法吗？" : question.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{complete ? "你的回答已成为企业资料，之后写内容时可以直接引用。菜单、照片和历史文章可以后续补充。" : showPreview ? "经营信息来自你的回答。下面的内容方向和顾客建议可以修改，不确定的地方继续保留为待验证。确认后才会生效。" : question.description}</p>
        {complete ? (
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="font-semibold">{state.answers.accountName}</p>
            <p className="mt-3 text-sm leading-6">这次的目标：{state.answers.goal}</p>
            <p className="mt-3 text-sm leading-6">先宣传：{state.answers.offer}</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link className={primaryButtonClass} href="/setup/first-content">选口吻，写第一篇</Link><Link className={secondaryButtonClass} href="/knowledge">补充资料</Link><button className={secondaryButtonClass} type="button" onClick={() => { setShowPreview(false); setStep(0); setMessage(null); }}>调整经营信息</button></div>
          </section>
        ) : (
          <fieldset className="mt-7 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" disabled={busy} aria-busy={busy}>
            <legend className="sr-only">{showPreview ? "核对经营信息和内容方向" : question.title}</legend>
            {showPreview ? (
              <>
                <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm leading-6">
                  <div><dt className="text-slate-500">你提供的经营信息</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers.accountName} · {answers.business}</dd></div>
                  <div><dt className="text-slate-500">近期目标</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers.goal}</dd></div>
                  <div><dt className="text-slate-500">主推产品或服务</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers.offer}</dd></div>
                  <div><dt className="text-slate-500">顾客与场景 / 真实特点</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers.audience || "顾客与场景待验证"}{"\n"}{answers.differentiator || "真实特点待补充"}</dd></div>
                  <div><dt className="text-slate-500">表达偏好 / 不要写的内容</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers.tone || "自然日常表达"}{"\n"}{answers.boundaries || "暂未补充"}</dd></div>
                </dl>
                <div className="mt-6 grid gap-5">
                  <AnswerInput id="suggested-position" label="建议内容方向（可以修改）" value={position} onChange={setPosition} />
                  <AnswerInput id="suggested-audience" label="建议先写给谁（每行一个，不确定可标为待验证）" value={audience} onChange={setAudience} />
                  <AnswerInput id="suggested-pillars" label="建议持续写的几个方向（每行一个）" value={pillars} onChange={setPillars} />
                </div>
                {state.preview?.account.informationGaps.length ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="font-semibold">以后继续确认</p><ul className="mt-2 list-disc pl-5">{state.preview.account.informationGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div> : null}
                <div className="mt-7 flex flex-wrap gap-3"><button className={secondaryButtonClass} type="button" onClick={() => { setShowPreview(false); setStep(0); }}>返回修改回答</button><button className={primaryButtonClass} type="button" onClick={() => void submit("confirm")}>{busy ? "正在保存…" : "确认，保存经营信息"}</button></div>
              </>
            ) : (
              <>
                <div className="grid gap-6">
                  {question.fields.map((field) => <div key={field.id}><AnswerInput id={field.id} label={`${field.label}${field.optional ? "（可选）" : ""}`} value={answers[field.id]} placeholder={field.placeholder} maxLength={field.id === "accountName" ? 120 : 2000} onChange={(value) => setAnswers({ ...answers, [field.id]: value })} />{field.optional && field.id !== "boundaries" ? <button className="mt-2 text-sm text-emerald-800 underline underline-offset-4" type="button" onClick={() => setAnswers({ ...answers, [field.id]: "" })}>还不确定，稍后再补</button> : null}</div>)}
                  {step === 1 ? <div className="flex flex-wrap gap-2">{["获得新客户", "让老客知道新品", "增加复购", "收到更多咨询"].map((goal) => <button className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:border-emerald-700" type="button" key={goal} onClick={() => setAnswers({ ...answers, goal })}>{goal}</button>)}</div> : null}
                  {step === 5 ? <div className="grid gap-3 sm:grid-cols-2">{contentChannels.map((channel) => <label key={channel} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${answers.primaryChannel === channel ? "border-emerald-800 bg-emerald-50" : "border-slate-200"}`}><input type="radio" name="primaryChannel" checked={answers.primaryChannel === channel} onChange={() => setAnswers({ ...answers, primaryChannel: channel })} /><span className="text-sm">{channelLabels[channel]}</span></label>)}</div> : null}
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  {step > 0 ? <button className={secondaryButtonClass} type="button" onClick={() => setStep(step - 1)}>上一步</button> : null}
                  <button className={primaryButtonClass} type="button" disabled={question.fields.some((field) => !field.optional && !answers[field.id].trim()) || (step === 5 && !answers.primaryChannel)} onClick={() => void submit(step === 5 ? "preview" : "save", Math.min(step + 1, 5))}>{busy ? step === 5 ? "正在整理，回答已保存…" : "正在保存…" : step === 5 ? "帮我整理内容方向" : "保存并继续"}</button>
                  <button className="px-2 py-2 text-sm text-slate-600 underline underline-offset-4" type="button" onClick={() => void submit("save", step, true)}>保存并退出</button>
                </div>
              </>
            )}
          </fieldset>
        )}
        {message ? <p className="mt-4 text-sm leading-6 text-emerald-900" role="status">{message}</p> : null}
        {!complete ? <p className="mt-5 text-xs leading-5 text-slate-500">“保存并退出”会保存已填回答并返回建档概览，下次可以从当前步骤继续。回答确认后才会成为正式经营资料。</p> : null}
      </div>
    </main>
  );
}

function AnswerInput({ id, label, value, onChange, placeholder, maxLength = 2000 }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  return <div><label className="block text-sm font-semibold leading-6" htmlFor={id}>{label}</label><textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-3 text-base leading-6 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15" id={id} value={value} placeholder={placeholder} maxLength={maxLength} rows={id === "accountName" ? 2 : 3} onChange={(event) => onChange(event.target.value)} /></div>;
}

function lines(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
