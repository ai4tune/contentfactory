import { redirect } from "next/navigation";
import { getCurrentContentPlan } from "@/modules/plans/repository";
import { getOnboardingSnapshot } from "@/modules/onboarding/service";
import { PlanWorkspace } from "@/modules/plans/components/plan-workspace";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [snapshot, plan] = await Promise.all([
    getOnboardingSnapshot(),
    getCurrentContentPlan(),
  ]);
  if (snapshot.status.state !== "completed") redirect("/setup");
  return <PlanWorkspace initialPlan={plan} onboarding={snapshot.status} />;
}
