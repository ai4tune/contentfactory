export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function supabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
}

export function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function contentFactoryWorkspaceId() {
  return process.env.CONTENT_FACTORY_WORKSPACE_ID?.trim() || "";
}

export function isSupabaseAuthConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function isSupabasePersistenceConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey() && contentFactoryWorkspaceId());
}
