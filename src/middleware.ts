import { NextRequest, NextResponse } from "next/server";

const DEFAULT_USER = "contentfactory";

// Next.js 16 的 Node proxy 仍存在请求体克隆竞态。试点期保留 Edge middleware
// 兼容入口，避免内容生成等 JSON 请求被偶发截断。
export function middleware(request: NextRequest) {
  const accessCode = process.env.CONTENT_FACTORY_ACCESS_CODE;

  if (!accessCode) {
    if (process.env.NODE_ENV !== "production") return;
    return unavailable(request);
  }

  const expectedUser = process.env.CONTENT_FACTORY_ACCESS_USER || DEFAULT_USER;
  const credentials = readBasicCredentials(request.headers.get("authorization"));
  if (credentials
    && constantTimeEqual(credentials.user, expectedUser)
    && constantTimeEqual(credentials.password, accessCode)) {
    return NextResponse.next();
  }

  return new NextResponse("需要访问授权。", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="AI Content Factory", charset="UTF-8"',
    },
  });
}

function readBasicCredentials(value: string | null) {
  if (!value?.startsWith("Basic ")) return null;
  try {
    const binary = atob(value.slice(6));
    const decoded = new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function unavailable(request: NextRequest) {
  const message = "生产实例尚未配置访问码，请联系管理员。";
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, { status: 503 });
  }
  return new NextResponse(message, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export const config = {
  matcher: [
    "/((?!api/health|api/capture|api/topics/search-plan|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
