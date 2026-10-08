import { createServerSupabaseClient } from "./server";
import { contentFactoryWorkspaceId } from "./config";
import { cache } from "react";

export const getWorkspaceMembership = cache(async () => {
  const workspaceId = contentFactoryWorkspaceId();
  if (!workspaceId) return null;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("content_factory_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? { userId: user.id, email: user.email, role: data.role as "owner" | "member" } : null;
});
