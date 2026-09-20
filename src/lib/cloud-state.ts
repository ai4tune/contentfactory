import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { contentFactoryWorkspaceId } from "@/lib/supabase/config";
import type { Json } from "@/lib/supabase/database.types";

type StateRow<T> = { payload: T; version: number };

export async function readCloudState<T>(storeKey: string, fallback: T): Promise<T> {
  const workspaceId = requiredWorkspaceId();
  const { data, error } = await createAdminSupabaseClient()
    .from("content_factory_state")
    .select("payload")
    .eq("workspace_id", workspaceId)
    .eq("store_key", storeKey)
    .maybeSingle();
  if (error) throw new Error(`Cloud state read failed (${storeKey}): ${error.message}`);
  return data ? data.payload as T : fallback;
}

export async function updateCloudState<T>(
  storeKey: string,
  fallback: T,
  update: (current: T) => T | Promise<T>,
): Promise<T> {
  const workspaceId = requiredWorkspaceId();
  const supabase = createAdminSupabaseClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await readStateRow<T>(storeKey);
    const next = await update(current?.payload ?? fallback);

    if (!current) {
      const { error } = await supabase.from("content_factory_state").insert({
        workspace_id: workspaceId,
        store_key: storeKey,
        payload: next as unknown as Json,
        version: 1,
        updated_at: new Date().toISOString(),
      });
      if (!error) return next;
      if (error.code === "23505") continue;
      throw new Error(`Cloud state insert failed (${storeKey}): ${error.message}`);
    }

    const { data, error } = await supabase
      .from("content_factory_state")
      .update({ payload: next as unknown as Json, version: current.version + 1, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("store_key", storeKey)
      .eq("version", current.version)
      .select("version")
      .maybeSingle();
    if (error) throw new Error(`Cloud state update failed (${storeKey}): ${error.message}`);
    if (data) return next;
  }

  throw new Error(`Cloud state update conflicted too many times (${storeKey}).`);
}

async function readStateRow<T>(storeKey: string): Promise<StateRow<T> | null> {
  const workspaceId = requiredWorkspaceId();
  const { data, error } = await createAdminSupabaseClient()
    .from("content_factory_state")
    .select("payload, version")
    .eq("workspace_id", workspaceId)
    .eq("store_key", storeKey)
    .maybeSingle();
  if (error) throw new Error(`Cloud state read failed (${storeKey}): ${error.message}`);
  return data ? { payload: data.payload as T, version: Number(data.version) } : null;
}

function requiredWorkspaceId() {
  const workspaceId = contentFactoryWorkspaceId();
  if (!workspaceId) throw new Error("CONTENT_FACTORY_WORKSPACE_ID is not configured.");
  return workspaceId;
}
