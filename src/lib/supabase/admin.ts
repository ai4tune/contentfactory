import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./config";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export function createAdminSupabaseClient() {
  if (client) return client;
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("Supabase persistence is not configured.");
  client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
