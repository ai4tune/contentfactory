import { localDate } from "@/modules/plans/calendar";
import { redirect } from "next/navigation";
import { listContentPlans } from "@/modules/plans/repository";
import { getDashboardSummary } from "@/modules/dashboard/server/summary";
import { getOnboardingSnapshot } from "@/modules/onboarding/service";
import { PlanWorkspace } from "@/modules/plans/components/plan-workspace";

export const dynamic = "force-dynamic";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ planId?: string }> }) {
  const { planId } = await searchParams;
  const [snapshot, summary, plans] = await Promise.all([
    getOnboardingSnapshot(),
    getDashboardSummary(),
    listContentPlans(),
  ]);
  if (snapshot.status.state !== "completed") redirect("/setup");
  const plan = planId ? plans.find((item) => item.id === planId) : summary.contentPlan;
  if (planId && !plan) redirect("/plans");
  return <PlanWorkspace initialPlan={plan ?? null} onboarding={snapshot.status} drafts={summary.drafts} serverDate={localDate(new Date(), plan?.timeZone)} history={plans.map(({ id, title, periodStart, periodEnd, status }) => ({ id, title, periodStart, periodEnd, status }))} />;
}
