import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { getWorkspaceMembership } from "@/lib/supabase/authorization";
import { InvitationForm } from "./invitation-form";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  if ((await getWorkspaceMembership())?.role !== "owner") redirect("/access-denied");
  return <AppShell active="/operations/invitations">
    <PageHeader title="邀请用户" description="输入邮箱，发送邀请并开通普通成员权限。每位用户使用自己的独立内容空间。" />
    <InvitationForm />
  </AppShell>;
}
