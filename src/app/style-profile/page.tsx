import { StyleProfileWorkspace } from "@/modules/style-profile/components/style-profile-workspace";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import {
  getConfirmedStyleProfile,
  getCurrentStyleProfile,
} from "@/modules/style-profile/repository";

export const dynamic = "force-dynamic";

export default async function StyleProfilePage() {
  const [account, profile, confirmedProfile] = await Promise.all([
    getCurrentAccountContext(),
    getCurrentStyleProfile(),
    getConfirmedStyleProfile(),
  ]);

  return (
    <StyleProfileWorkspace
      accountName={account?.accountName ?? "当前账号"}
      initialConfirmedProfile={confirmedProfile}
      initialProfile={profile}
    />
  );
}
