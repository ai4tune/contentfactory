import { NextRequest, NextResponse } from "next/server";
import { getOperationSummary } from "@/lib/db";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getWorkspaceMembership } from "@/lib/supabase/authorization";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (isSupabaseAuthConfigured() && (await getWorkspaceMembership())?.role !== "owner") {
    return NextResponse.json({ error: "此页面只对运营者开放。" }, { status: 403 });
  }
  const rawDays = Number(request.nextUrl.searchParams.get("days") || 7);
  const days = Number.isFinite(rawDays) ? rawDays : 7;
  return NextResponse.json(await getOperationSummary(days));
}
