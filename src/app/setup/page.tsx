import { getOnboardingSnapshot } from "@/modules/onboarding/service";
import {
  SetupWorkspace,
  type SetupWorkspaceData,
} from "@/modules/onboarding/components/setup-workspace";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const snapshot = await getOnboardingSnapshot();
  const initialData: SetupWorkspaceData = {
    status: snapshot.status,
    serverKnowledgeCount: snapshot.serverKnowledgeCount,
    account: snapshot.account ? {
      accountName: snapshot.account.accountName,
      accountPosition: snapshot.account.accountPosition,
      business: snapshot.account.business,
      contentPillars: snapshot.account.contentPillars,
      conversionGoal: snapshot.account.conversionGoal,
      offer: snapshot.account.offer,
      platforms: snapshot.account.platforms,
      targetAudience: snapshot.account.targetAudience,
    } : null,
    styleProfile: snapshot.styleProfile ? {
      name: snapshot.styleProfile.name,
      version: snapshot.styleProfile.version,
    } : null,
  };
  return <SetupWorkspace initialData={initialData} />;
}
