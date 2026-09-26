import { redirect } from "next/navigation";
import { AgentWorkspace } from "@/modules/agent/components/agent-workspace";
import { getDashboardSummary } from "@/modules/dashboard/server/summary";
import { getOnboardingSnapshot } from "@/modules/onboarding/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [onboarding, summary] = await Promise.all([
    getOnboardingSnapshot(),
    getDashboardSummary(),
  ]);
  if (onboarding.status.state !== "completed") redirect("/setup");

  return <AgentWorkspace primaryChannel={onboarding.status.primaryChannel} summary={summary} />;
}
