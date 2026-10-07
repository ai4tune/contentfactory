import { NextResponse } from "next/server";
import { getDataWorkspaceId } from "@/lib/data-workspace";
import { checkCaptureAccess } from "@/modules/positioning/capture-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== "string" || body.token.length > 2048) {
    return NextResponse.json({ authorized: false, error: "请重新授权此浏览器。" }, { status: 400, headers });
  }
  const captureHeaders = new Headers(request.headers);
  captureHeaders.set("Authorization", `Bearer ${body.token}`);
  const access = await checkCaptureAccess(new Request(request.url, { headers: captureHeaders }));
  if (!access.allowed) {
    return NextResponse.json({ authorized: false, error: "采集授权已失效，请重新授权此浏览器。" }, { headers });
  }
  const workspaceId = await getDataWorkspaceId();
  const authorized = access.workspaceId === workspaceId;
  return NextResponse.json({ authorized, ...(authorized ? {} : { error: "插件授权属于其他登录账号，请重新授权此浏览器。" }) }, { headers });
}
