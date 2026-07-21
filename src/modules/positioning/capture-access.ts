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
  const localExtension = isLoopback(requestUrl.hostname) && origin.startsWith("chrome-extension://");
  const configuredOrigin = allowedOrigins.has(origin);
  const tokenPreflight = preflight && Boolean(configuredToken) && origin.startsWith("chrome-extension://");
  const allowed = Boolean(origin) && (sameOrigin || localExtension || configuredOrigin || tokenValid || tokenPreflight);

  return {
    allowed,
    corsHeaders: origin ? {
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
