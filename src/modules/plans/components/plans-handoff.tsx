"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import { channelLabels } from "@/modules/content/types";
import type { OnboardingStatus } from "@/modules/onboarding/types";
import type { ContentPlan } from "@/modules/plans/types";

export function PlansHandoff({
  initialPlan,
  onboarding,
}: {
  initialPlan: ContentPlan | null;
  onboarding: OnboardingStatus;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/content-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryChannel: onboarding.primaryChannel }),
      });
      const payload = await response.json() as { plan?: ContentPlan; error?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error ?? "内容计划生成失败。");
      setPlan(payload.plan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "内容计划生成失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/plans">
      <PageHeader
        title="内容计划"
        description="根据已确认的企业资料生成未来 30 天选题，并从本周优先内容开始执行。"
        actions={<Link className={secondaryButtonClass} href="/setup">查看企业建档</Link>}
      />
      {!plan ? (
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-emerald-800">下一步</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">生成第一份 30 天内容计划</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            AI 会使用已确认的企业信息、账号定位和{onboarding.primaryChannel ? channelLabels[onboarding.primaryChannel] : "主渠道"}，生成 3 到 5 个内容支柱、30 个候选选题和本周 7 个优先选题。
          </p>
          {onboarding.informationGaps.length ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">生成前请留意</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">{onboarding.informationGaps[0]}</p>
            </div>
          ) : null}
          <button className={`${primaryButtonClass} mt-6`} disabled={busy} onClick={generatePlan} type="button">
            {busy ? "正在生成 30 天计划" : "生成内容计划"}
          </button>
          {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="mt-7 rounded-2xl bg-[#173e32] p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-[#dfb967]">当前 30 天计划</p>
                <h2 className="mt-3 text-2xl font-semibold">{plan.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">{plan.operatingGoal}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <PlanMetric label="候选选题" value={plan.items.length} />
                <PlanMetric label="本周优先" value={plan.items.filter((item) => item.week === 1).length} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {plan.pillars.map((pillar) => <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80" key={pillar.id}>{pillar.name}</span>)}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">本周优先选题</h2>
              <p className="mt-1 text-sm text-slate-500">选择一篇进入进阶创作流程；后续仍可返回查看企业建档和内容计划。</p>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {plan.items.filter((item) => item.week === 1).map((item) => (
                <article className="rounded-2xl border border-slate-200 p-4" key={item.id}>
                  <p className="text-sm font-semibold leading-6 text-slate-900">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.rationale}</p>
                  <Link className="mt-4 inline-flex text-xs font-semibold text-emerald-800 hover:text-emerald-950" href={`/create?title=${encodeURIComponent(item.title)}`}>用这个选题开始创作</Link>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function PlanMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-24 rounded-2xl bg-white/10 px-4 py-3"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/55">{label}</p></div>;
}
