import { createServerSupabaseClient } from "./server";
import { contentFactoryWorkspaceId } from "./config";

export async function getWorkspaceMembership() {
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
  return data ? { userId: user.id, role: data.role as "owner" | "member" } : null;
}
