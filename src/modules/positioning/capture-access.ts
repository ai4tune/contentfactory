import { createHmac, timingSafeEqual } from "node:crypto";
import { contentFactoryWorkspaceId, isSupabaseAuthConfigured, supabaseSecretKey } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { personalDataWorkspaceId } from "@/lib/data-workspace";

export type CaptureAccess = {
  allowed: boolean;
  corsHeaders: HeadersInit;
  workspaceId: string | null;
};

export async function checkCaptureAccess(request: Request, preflight = false): Promise<CaptureAccess> {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set(
    (process.env.CAPTURE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const configuredToken = process.env.CONTENT_FACTORY_CAPTURE_TOKEN?.trim() ?? "";
  const suppliedToken = readBearerToken(request.headers.get("authorization"));
  const cloudAuth = isSupabaseAuthConfigured();
  const workspaceId = cloudAuth ? verifyCaptureToken(suppliedToken, supabaseSecretKey()) : null;
  let tokenValid = cloudAuth ? Boolean(workspaceId) : Boolean(configuredToken && safeEqual(configuredToken, suppliedToken));
  if (tokenValid && workspaceId && !preflight) {
    const supabase = createAdminSupabaseClient();
    const owner = await supabase.from("content_factory_workspace_members")
      .select("user_id").eq("workspace_id", workspaceId).eq("role", "owner").maybeSingle();
    if (owner.error || !owner.data || personalDataWorkspaceId(owner.data.user_id) !== workspaceId) tokenValid = false;
    else {
      const { data, error } = await supabase.from("content_factory_workspace_members")
        .select("role").eq("workspace_id", contentFactoryWorkspaceId()).eq("user_id", owner.data.user_id).maybeSingle();
      tokenValid = !error && Boolean(data);
    }
  }
  const sameOrigin = origin === requestUrl.origin;
  const extensionOrigin = origin.startsWith("chrome-extension://");
  const localDevelopmentExtension = !cloudAuth && process.env.NODE_ENV !== "production"
    && isLoopback(requestUrl.hostname)
    && extensionOrigin;
  const configuredOrigin = allowedOrigins.has(origin);
  const extensionCorsAllowed = extensionOrigin
    && (allowedOrigins.size > 0 ? configuredOrigin : Boolean(configuredToken));
  const corsAllowed = !origin
    || sameOrigin
    || configuredOrigin
    || extensionCorsAllowed
    || localDevelopmentExtension;
  const credentialValid = tokenValid || localDevelopmentExtension;
  const allowed = preflight
    ? Boolean(origin) && corsAllowed && (Boolean(configuredToken) || localDevelopmentExtension)
    : corsAllowed && credentialValid;

  return {
    allowed,
    workspaceId,
    corsHeaders: origin && corsAllowed ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    } : {},
  };
}

export function createCaptureToken(workspaceId: string, secret: string) {
  const payload = `cf1.${workspaceId}.${Math.floor(Date.now() / 1000) + 30 * 86_400}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function verifyCaptureToken(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "cf1" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parts[1])) return null;
  const expires = Number(parts[2]);
  if (!Number.isFinite(expires) || expires <= Date.now() / 1000) return null;
  const signature = createHmac("sha256", secret).update(parts.slice(0, 3).join(".")).digest("base64url");
  return safeEqual(signature, parts[3]) ? parts[1] : null;
}

function readBearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function safeEqual(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
