import { timingSafeEqual } from "node:crypto";

export type CaptureAccess = {
  allowed: boolean;
  corsHeaders: HeadersInit;
};

export function checkCaptureAccess(request: Request, preflight = false): CaptureAccess {
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
  const tokenValid = configuredToken ? safeEqual(configuredToken, suppliedToken) : false;
  const sameOrigin = origin === requestUrl.origin;
  const extensionOrigin = origin.startsWith("chrome-extension://");
  const localDevelopmentExtension = process.env.NODE_ENV !== "production"
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
    corsHeaders: origin && corsAllowed ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    } : {},
  };
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
