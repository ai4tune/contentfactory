"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./config";

export function createBrowserSupabaseClient() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) throw new Error("登录服务尚未配置，请联系管理员。");
  return createBrowserClient(url, key);
}
