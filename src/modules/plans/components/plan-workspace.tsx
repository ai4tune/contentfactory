"use client";

import Link from "@/components/navigation-link";
import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels, contentChannels, type ContentChannel } from "@/modules/content/types";
import type { OnboardingStatus } from "@/modules/onboarding/types";
import { planItemState, type DashboardDraft } from "@/modules/dashboard/task";
import { daysBetween, defaultTimeZone, planWeek } from "@/modules/plans/calendar";
import { useLocalDate } from "@/modules/plans/use-local-date";
import { planTaskLabels, type PlanTaskType } from "@/modules/plans/types";
import type {
  ContentObjective,
  ContentPlan,
  ContentPlanItem,
  ContentPlanItemStatus,
} from "@/modules/plans/types";

const objectiveLabels: Record<ContentObjective, string> = {
  reach: "曝光",
  trust: "信任",
  conversion: "转化",
};

const itemStatusLabels: Record<ContentPlanItemStatus, string> = {
  pending: "待创作",
  writing: "创作中",
  generated: "待审核",
  published: "已发布",
  reviewed: "已复盘",
  paused: "已暂停",
  completed: "已完成",
};

const evidenceLabels = {
  enterprise_knowledge: "企业知识",
  customer_pain: "客户问题",
  market_signal: "市场信号",
  inspiration: "爆款参考",
};

export function PlanWorkspace({
  initialPlan,
  onboarding,
  drafts,
  serverDate,
  history,
}: {
  initialPlan: ContentPlan | null;
  onboarding: OnboardingStatus;
  drafts: DashboardDraft[];
  serverDate: string;
  history: Array<Pick<ContentPlan, "id" | "title" | "periodStart" | "periodEnd" | "status">>;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const today = useLocalDate(serverDate, plan?.timeZone);
  const [selectedWeekOverride, setSelectedWeek] = useState<number | null>(null);
  const selectedWeek = selectedWeekOverride ?? (plan ? planWeek(plan, today) : 1);
  const weekCount = plan ? Math.max(Math.ceil((daysBetween(plan.periodStart, plan.periodEnd) + 1) / 7), ...plan.items.map((item) => item.week)) : 1;
  const [periodDays, setPeriodDays] = useState(7);
  const [publishingFrequency, setPublishingFrequency] = useState(3);
  const [periodStart, setPeriodStart] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "操作失败，请重试。" });
    } finally {
      setBusy(null);
    }
  }

  async function generatePlan() {
    await run("generate", async () => {
      const payload = await requestPlan("/api/content-plans", {
        method: "POST",
        body: { primaryChannel: onboarding.primaryChannel, periodDays, publishingFrequency, periodStart: periodStart || today, timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimeZone },
      });
      setPlan(payload);
      setSelectedWeek(null);
      setMessage({ kind: "success", text: "内容安排已生成，请检查日期、选题与推荐依据。" });
    });
  }

  async function updatePlan(update: Record<string, unknown>) {
    if (!plan) return;
    await run("plan", async () => {
      const payload = await requestPlan(`/api/content-plans/${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        body: update,
      });
      setPlan(payload);
      setEditingPlan(false);
      setMessage({ kind: "success", text: update.status === "confirmed" ? "计划已确认，可以开始本周创作。" : "计划设置已保存。" });
    });
  }

  async function updateItem(itemId: string, update: Record<string, unknown>, successText: string) {
    if (!plan) return;
    await run(`item:${itemId}`, async () => {
      const payload = await requestPlan(
        `/api/content-plans/${encodeURIComponent(plan.id)}/items/${encodeURIComponent(itemId)}`,
        { method: "PATCH", body: update },
      );
      setPlan(payload);
      setEditingItemId(null);
      setMessage({ kind: "success", text: successText });
    });
  }

  async function regenerateUnlockedItems() {
    if (!plan || !window.confirm("只重新生成后续待办选题。过去、已开始、已发布、暂停和锁定的任务会保留。确定继续吗？")) return;
    await run("regenerate", async () => {
      const evidence = Array.from(new Map(
        plan.items.flatMap((item) => item.evidence)
          .filter((item) => item.refId)
          .map((item) => [`${item.type}:${item.refId}`, item]),
      ).values());
      const payload = await requestPlan(`/api/content-plans/${encodeURIComponent(plan.id)}/generate`, {
        method: "POST",
        body: { contextEvidence: evidence },
      });
      setPlan(payload);
      setMessage({ kind: "success", text: "后续待办已处理；过去、已开始和锁定的内容保持不变。" });
    });
  }

  return (
    <AppShell active="/plans">
      <PageHeader
        eyebrow="CONTENT PLAN"
        title="内容计划"
        description="选择 7 天或 30 天，按自己的发布频率安排；也可以暂不定计划，先写一篇。"
        actions={<Link className={secondaryButtonClass} href="/setup/first-content">先写一篇</Link>}
      />

      {!plan ? (
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-emerald-800">下一步</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">安排接下来一段时间</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            系统使用已确认的账号定位和{onboarding.primaryChannel ? channelLabels[onboarding.primaryChannel] : "主渠道"}安排选题。周期是时间范围，选题数量按每周发布频率计算。
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="计划周期"><select className={inputClass} value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}><option value={7}>7 天，先跑一轮</option><option value={30}>30 天</option></select></Field>
            <Field label="每周发布篇数"><input className={inputClass} type="number" min={1} max={14} required value={publishingFrequency} onChange={(event) => setPublishingFrequency(Number(event.target.value))} /></Field>
            <Field label="开始日期"><input className={inputClass} type="date" value={periodStart || today} onChange={(event) => setPeriodStart(event.target.value)} /></Field>
            <Field label="运营时区（留空使用当前电脑时区）"><input className={inputClass} placeholder="Asia/Shanghai" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} /></Field>
          </div>
          {onboarding.informationGaps.length ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">生成前请留意</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">{onboarding.informationGaps[0]}</p>
              {onboarding.informationGaps[0].startsWith("账号分析待补充：") ? <Link className="mt-3 inline-block text-sm font-semibold text-amber-950 underline underline-offset-4" href="/positioning">去当前账号补充 →</Link> : null}
            </div>
          ) : null}
          <button className={`${primaryButtonClass} mt-6`} disabled={busy !== null} onClick={generatePlan} type="button">
            {busy === "generate" ? "正在生成内容安排" : "生成内容计划"}
          </button>
          {busy === "generate" ? <p className="mt-3 text-sm text-slate-500">正在按周期与频率生成选题，请勿重复点击。</p> : null}
        </section>
      ) : (
        <>
          <section className="mt-7 rounded-2xl bg-[#173e32] p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/70">{plan.status === "archived" ? "已归档" : plan.status === "confirmed" ? "计划已确认" : "计划待确认"}</span>
                  <span className="text-xs text-white/45">{plan.periodStart} 至 {plan.periodEnd}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{plan.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/70">{plan.operatingGoal}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PlanMetric label="全部安排" value={plan.items.length} />
                <PlanMetric label="当前周次" value={planWeek(plan, today)} />
                <PlanMetric label="已锁定" value={plan.items.filter((item) => item.locked).length} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {plan.pillars.map((pillar) => <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80" key={pillar.id}>{pillar.name}</span>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              {plan.status === "draft" ? (
                <button className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#dfb967] px-4 text-sm font-semibold text-[#12231d] transition hover:bg-[#ebca82] disabled:opacity-50" disabled={busy !== null} onClick={() => updatePlan({ status: "confirmed" })} type="button">
                  {busy === "plan" ? "正在确认" : "确认这份安排"}
                </button>
              ) : null}
              <button className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50" disabled={busy !== null} onClick={() => { setPlan(null); setSelectedWeek(null); }} type="button">新建计划</button>
              <button className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50" disabled={busy !== null} onClick={() => setEditingPlan((current) => !current)} type="button">编辑计划设置</button>
              <button className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50" disabled={busy !== null || plan.status === "archived"} onClick={regenerateUnlockedItems} type="button">
                {busy === "regenerate" ? "正在重新生成" : "重新生成后续待办"}
              </button>
            </div>
            {busy === "regenerate" ? <p className="mt-3 text-sm text-white/70">正在重新生成选题，可能需要 1～3 分钟；原计划会保留到成功为止。</p> : null}
          </section>

          {editingPlan ? <PlanSettingsForm busy={busy !== null} key={plan.updatedAt} onCancel={() => setEditingPlan(false)} onSave={updatePlan} plan={plan} /> : null}

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {plan.pillars.map((pillar) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4" key={pillar.id}>
                <p className="text-xs font-semibold text-emerald-800">内容支柱 {pillar.priority}</p>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{pillar.name}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{pillar.description}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{selectedWeek ? `第 ${selectedWeek} 周安排` : "全部安排"}</h2>
                <p className="mt-1 text-sm text-slate-500">人工修改会自动锁定，重新生成时不会被覆盖。</p>
              </div>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="按周筛选内容计划">
                {[...Array.from({ length: weekCount }, (_, index) => index + 1), 0].map((week) => (
                  <button aria-selected={selectedWeek === week} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedWeek === week ? "bg-[#173e32] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} key={week} onClick={() => setSelectedWeek(week)} role="tab" type="button">
                    {week ? `第 ${week} 周` : "全部"}
                  </button>
                ))}
              </div>
            </div>

            <ManualTaskForm busy={busy !== null} plan={plan} today={today} onAdd={(body) => run("add-task", async () => {
              setPlan(await requestPlan(`/api/content-plans/${encodeURIComponent(plan.id)}/items`, { method: "POST", body }));
              setMessage({ kind: "success", text: "运营任务已加入安排。完成后请手动确认。" });
            })} />
            <div className="mt-6 grid gap-4">
              {visibleItems(plan, selectedWeek).map((item) => (
                <PlanItemCard
                  busy={busy !== null}
                  drafts={drafts}
                  editing={editingItemId === item.id}
                  item={item}
                  key={item.id}
                  onCancelEdit={() => setEditingItemId(null)}
                  onEdit={() => setEditingItemId(item.id)}
                  onSave={(update) => updateItem(item.id, update, update.status === "completed" ? "任务已完成。" : update.status === "paused" ? "任务已暂停，不再推荐执行。" : "选题已保存，并自动锁定防止被重新生成覆盖。")}
                  onToggleLock={() => updateItem(item.id, { locked: !item.locked }, item.locked ? "选题已解锁。" : "选题已锁定。")}
                  pillarName={plan.pillars.find((pillar) => pillar.id === item.pillarId)?.name || "未分类"}
                  plan={plan}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {history.length ? <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-900">历史计划（{history.length}）</summary><ul className="mt-4 space-y-3">{history.map((item) => <li key={item.id}><Link className="text-sm text-emerald-800 underline underline-offset-4" href={`/plans?planId=${encodeURIComponent(item.id)}`}>{item.title} · {item.periodStart} 至 {item.periodEnd}</Link></li>)}</ul></details> : null}
      {message ? <p aria-live="polite" className={`mt-5 rounded-2xl px-4 py-3 text-sm ${message.kind === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p> : null}
    </AppShell>
  );
}

function PlanItemCard({
  busy,
  editing,
  item,
  onCancelEdit,
  onEdit,
  onSave,
  onToggleLock,
  pillarName,
  plan,
  drafts,
}: {
  drafts: DashboardDraft[];
  busy: boolean;
  editing: boolean;
  item: ContentPlanItem;
  onCancelEdit: () => void;
  onEdit: () => void;
  onSave: (update: Record<string, unknown>) => Promise<void>;
  onToggleLock: () => Promise<void>;
  pillarName: string;
  plan: ContentPlan;
}) {
  const state = planItemState(plan, item, drafts);
  const isContent = (item.taskType ?? "content") === "content";
  if (editing) return <TopicEditor busy={busy} item={item} onCancel={onCancelEdit} onSave={onSave} plan={plan} />;

  return (
    <article className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-emerald-800">{item.scheduledDate || `第 ${item.week} 周，未定具体日期`} · {planTaskLabels[item.taskType ?? "content"]}</span>
            {isContent ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{pillarName}</span> : null}
            {isContent ? <span className="rounded-lg bg-[#f5ecd9] px-2 py-1 text-[#76591d]">{objectiveLabels[item.objective]}</span> : null}
            <span className="rounded-lg bg-[#e9f0ec] px-2 py-1 text-emerald-900">{state.label}</span>
            {item.locked ? <span className="rounded-lg bg-slate-900 px-2 py-1 text-white">已锁定</span> : null}
          </div>
          <h3 className="mt-3 text-base font-semibold leading-7 text-slate-950">{item.title}</h3>
          {item.angle ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.angle}</p> : null}
          <p className="mt-3 text-xs leading-5 text-slate-500">推荐理由：{item.rationale}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {plan.status === "confirmed" ? <>
            <Link className={primaryButtonClass} href={state.href}>{state.actionLabel}</Link>
            {(item.taskType ?? "content") !== "content" && item.status === "pending" ? <button className={secondaryButtonClass} disabled={busy} onClick={() => onSave({ status: "completed" })} type="button">确认任务已完成</button> : null}
          </> : <span className="inline-flex min-h-10 items-center rounded-xl bg-slate-100 px-4 text-xs font-semibold text-slate-400">{plan.status === "archived" ? "已归档" : "确认安排后执行"}</span>}
          <button className={secondaryButtonClass} disabled={busy} onClick={onEdit} type="button">编辑</button>
          <button className={secondaryButtonClass} disabled={busy} onClick={onToggleLock} type="button">{item.locked ? "解锁" : "锁定"}</button>
        </div>
      </div>
      {isContent ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {item.evidence.map((evidence, index) => (
          <span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600" key={`${evidence.type}:${evidence.refId ?? evidence.label}:${index}`} title={evidence.label}>
            {evidenceLabels[evidence.type]} · {evidence.label}
          </span>
        ))}
      </div> : null}
    </article>
  );
}

function TopicEditor({ busy, item, onCancel, onSave, plan }: { busy: boolean; item: ContentPlanItem; onCancel: () => void; onSave: (update: Record<string, unknown>) => Promise<void>; plan: ContentPlan }) {
  const isContent = (item.taskType ?? "content") === "content";
  const [title, setTitle] = useState(item.title);
  const [angle, setAngle] = useState(item.angle ?? "");
  const [rationale, setRationale] = useState(item.rationale);
  const [pillarId, setPillarId] = useState(item.pillarId);
  const [objective, setObjective] = useState<ContentObjective>(item.objective);
  const [status, setStatus] = useState<ContentPlanItemStatus>(item.status);
  const [priority, setPriority] = useState(String(item.priority));
  const [scheduledDate, setScheduledDate] = useState(item.scheduledDate ?? "");

  return (
    <form className="rounded-2xl border border-emerald-800/40 bg-[#f7faf8] p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); void onSave({ title, angle, rationale, pillarId, objective, status, priority: Number(priority), scheduledDate, locked: true }); }}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label={isContent ? "选题标题" : "任务名称"}><input className={inputClass} maxLength={300} onChange={(event) => setTitle(event.target.value)} required value={title} /></Field>
        {isContent ? <Field label="内容角度"><input className={inputClass} maxLength={500} onChange={(event) => setAngle(event.target.value)} value={angle} /></Field> : null}
        {isContent ? <Field label="内容支柱"><select className={inputClass} onChange={(event) => setPillarId(event.target.value)} value={pillarId}>{plan.pillars.map((pillar) => <option key={pillar.id} value={pillar.id}>{pillar.name}</option>)}</select></Field> : null}
        {isContent ? <Field label="内容目的"><select className={inputClass} onChange={(event) => setObjective(event.target.value as ContentObjective)} value={objective}>{Object.entries(objectiveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field> : null}
        <Field label="当前状态"><select className={inputClass} onChange={(event) => setStatus(event.target.value as ContentPlanItemStatus)} value={status}>{Object.entries(itemStatusLabels).filter(([value]) => (item.taskType ?? "content") === "content" ? [item.status === "paused" ? (item.contentProjectId ? "writing" : "pending") : item.status, "paused"].includes(value as ContentPlanItemStatus) : ["pending", "paused", "completed"].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="优先级"><input className={inputClass} min={1} onChange={(event) => setPriority(event.target.value)} required type="number" value={priority} /></Field><Field label="计划日期"><input className={inputClass} onChange={(event) => setScheduledDate(event.target.value)} type="date" value={scheduledDate} min={[plan.periodStart, item.scheduledDate || plan.periodStart].sort()[0]} max={[plan.periodEnd, item.scheduledDate || plan.periodEnd].sort()[1]} /></Field></div>
        <div className="lg:col-span-2"><Field label="推荐理由"><textarea className={`${inputClass} min-h-24 py-3`} maxLength={1000} onChange={(event) => setRationale(event.target.value)} required value={rationale} /></Field></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><button className={primaryButtonClass} disabled={busy} type="submit">{busy ? "正在保存" : "保存选题"}</button><button className={secondaryButtonClass} disabled={busy} onClick={onCancel} type="button">取消</button></div>
    </form>
  );
}

function PlanSettingsForm({ busy, onCancel, onSave, plan }: { busy: boolean; onCancel: () => void; onSave: (update: Record<string, unknown>) => Promise<void>; plan: ContentPlan }) {
  const [title, setTitle] = useState(plan.title);
  const [operatingGoal, setOperatingGoal] = useState(plan.operatingGoal);
  const [primaryChannel, setPrimaryChannel] = useState<ContentChannel>(plan.primaryChannel);
  const [targetAudience, setTargetAudience] = useState(plan.targetAudience.join("、"));
  const [publishingFrequency, setPublishingFrequency] = useState(String(plan.publishingFrequency));
  const [periodStart, setPeriodStart] = useState(plan.periodStart);
  const [periodEnd, setPeriodEnd] = useState(plan.periodEnd);
  const [timeZone, setTimeZone] = useState(plan.timeZone || defaultTimeZone);

  return (
    <form className="mt-6 rounded-2xl border border-emerald-800/30 bg-white p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void onSave({ title, operatingGoal, primaryChannel, targetAudience: targetAudience.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean), publishingFrequency: Number(publishingFrequency), periodStart, periodEnd, timeZone }); }}>
      <h2 className="text-base font-semibold text-slate-900">计划设置</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">保存设置不会改写已有任务日期。需要按新频率调整后续选题时，再选择“重新生成后续待办”。</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label="计划名称"><input className={inputClass} maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} /></Field>
        <Field label="主渠道"><select className={inputClass} onChange={(event) => setPrimaryChannel(event.target.value as ContentChannel)} value={primaryChannel}>{contentChannels.map((channel) => <option key={channel} value={channel}>{channelLabels[channel]}</option>)}</select></Field>
        <div className="lg:col-span-2"><Field label="当前经营目标"><textarea className={`${inputClass} min-h-24 py-3`} maxLength={500} onChange={(event) => setOperatingGoal(event.target.value)} required value={operatingGoal} /></Field></div>
        <Field label="目标客户，用顿号或逗号分隔"><input className={inputClass} onChange={(event) => setTargetAudience(event.target.value)} required value={targetAudience} /></Field>
        <Field label="每周计划发布篇数"><input className={inputClass} max={14} min={1} onChange={(event) => setPublishingFrequency(event.target.value)} required type="number" value={publishingFrequency} /></Field>
        <Field label="开始日期"><input className={inputClass} onChange={(event) => setPeriodStart(event.target.value)} required type="date" value={periodStart} /></Field>
        <Field label="运营时区"><input className={inputClass} onChange={(event) => setTimeZone(event.target.value)} required value={timeZone} /></Field>
        <Field label="结束日期"><input className={inputClass} onChange={(event) => setPeriodEnd(event.target.value)} required type="date" value={periodEnd} /></Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><button className={primaryButtonClass} disabled={busy} type="submit">{busy ? "正在保存" : "保存计划设置"}</button><button className={secondaryButtonClass} disabled={busy} onClick={onCancel} type="button">取消</button></div>
    </form>
  );
}

function ManualTaskForm({ busy, plan, today, onAdd }: { busy: boolean; plan: ContentPlan; today: string; onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<PlanTaskType>("photos");
  const [date, setDate] = useState([plan.periodStart, today, plan.periodEnd].sort()[1]);
  if (plan.status === "archived") return null;
  return <details className="mt-5 rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">添加调研、拍照片或补资料任务</summary>
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onAdd({ title, taskType, scheduledDate: date }); }}>
      <Field label="任务名称"><input className={inputClass} required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="任务类型"><select className={inputClass} value={taskType} onChange={(event) => setTaskType(event.target.value as PlanTaskType)}>{Object.entries(planTaskLabels).filter(([value]) => value !== "content").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="安排日期"><input className={inputClass} type="date" required min={plan.periodStart} max={plan.periodEnd} value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <button className={`${primaryButtonClass} self-end`} disabled={busy} type="submit">加入安排</button>
    </form>
  </details>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700"><span>{label}</span>{children}</label>;
}

function PlanMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-20 rounded-2xl bg-white/10 px-3 py-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/55">{label}</p></div>;
}

function visibleItems(plan: ContentPlan, selectedWeek: number) {
  return plan.items
    .filter((item) => !selectedWeek || item.week === selectedWeek)
    .slice()
    .sort((left, right) => left.priority - right.priority);
}

async function requestPlan(url: string, options: { method: "POST" | "PATCH"; body: Record<string, unknown> }) {
  const response = await fetch(url, {
    method: options.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.body),
  });
  const payload = await response.json() as { plan?: ContentPlan; error?: string };
  if (!response.ok || !payload.plan) throw new Error(payload.error ?? "内容计划操作失败。");
  return payload.plan;
}

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-700";
