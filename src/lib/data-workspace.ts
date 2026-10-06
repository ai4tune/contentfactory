import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { cache } from "react";
import { getWorkspaceMembership } from "./supabase/authorization";
import { createAdminSupabaseClient } from "./supabase/admin";
import { contentFactoryWorkspaceId, isSupabaseAuthConfigured, isSupabasePersistenceConfigured } from "./supabase/config";

const workspaceContext = new AsyncLocalStorage<string>();

export function personalDataWorkspaceId(userId: string) {
  // Include the invitation space so Preview and other customer deployments cannot collide.
  const hex = createHash("sha256").update(`${contentFactoryWorkspaceId()}:${userId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// React cache is scoped to the current server request, never to the whole process.
const requestWorkspace = cache(async () => {
  const membership = await getWorkspaceMembership();
  if (!membership) throw new Error("请先登录已获授权的账号。");
  const workspaceId = personalDataWorkspaceId(membership.userId);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("content_factory_workspace_members")
    .select("role").eq("workspace_id", workspaceId).eq("user_id", membership.userId).maybeSingle();
  if (error) throw new Error("无法核对账号的数据空间，请稍后重试。");
  if (!data) {
    const workspace = await supabase.from("content_factory_workspaces")
      .upsert({ id: workspaceId, name: "个人内容空间" }, { onConflict: "id", ignoreDuplicates: true });
    if (workspace.error) throw new Error("无法建立账号的数据空间，请稍后重试。");
    const member = await supabase.from("content_factory_workspace_members")
      .upsert({ workspace_id: workspaceId, user_id: membership.userId, role: "owner" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
    if (member.error) throw new Error("无法建立账号的数据空间，请稍后重试。");
  }
  return workspaceId;
});

export async function getDataWorkspaceId(): Promise<string | null> {
  if (!isSupabaseAuthConfigured()) return null;
  if (!isSupabasePersistenceConfigured()) throw new Error("账号数据存储尚未配置，请联系管理员。");
  return workspaceContext.getStore() ?? requestWorkspace();
}

// Only server-verified identities may establish context for queues and capture tokens.
export function withDataWorkspace<T>(workspaceId: string | null, work: () => Promise<T>): Promise<T> {
  if (!workspaceId) {
    if (isSupabaseAuthConfigured()) throw new Error("后台任务缺少账号归属，无法访问数据。");
    return work();
  }
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workspaceId)) throw new Error("账号归属无效。");
  return workspaceContext.run(workspaceId, work);
}
