import { NextResponse } from "next/server";
import { getDataWorkspaceId } from "@/lib/data-workspace";
import { createCaptureToken } from "@/modules/positioning/capture-access";
import { supabaseSecretKey } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function POST() {
  const token = process.env.CONTENT_FACTORY_CAPTURE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "采集服务尚未配置，请联系管理员。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const workspaceId = await getDataWorkspaceId();
  return NextResponse.json(
    // The old shared capture token was sent to browsers and cannot be a signing secret.
    { token: workspaceId ? createCaptureToken(workspaceId, supabaseSecretKey()) : token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
