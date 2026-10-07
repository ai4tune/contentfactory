import { StyleProfileWorkspace } from "@/modules/style-profile/components/style-profile-workspace";
import { buildStarterStyle, voices } from "@/modules/onboarding/first-content/catalog";
import { getLatestAccountCapture } from "@/lib/store";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import {
  getConfirmedStyleProfile,
  getCurrentStyleProfile,
} from "@/modules/style-profile/repository";

export const dynamic = "force-dynamic";

export default async function StyleProfilePage() {
  const [account, profile, confirmedProfile, capture] = await Promise.all([
    getCurrentAccountContext(),
    getCurrentStyleProfile(),
    getConfirmedStyleProfile(),
    getLatestAccountCapture(),
  ]);

  return (
    <StyleProfileWorkspace
      accountName={account?.accountName ?? "当前账号"}
      initialConfirmedProfile={confirmedProfile}
      initialProfile={profile}
      initialCapture={capture}
      starterOptions={account?.status === "confirmed" ? voices.map((voice) => ({ id: voice.id, name: voice.name, sample: buildStarterStyle(account, "general", voice.id).examples[0].excerpt })) : []}
    />
  );
}
