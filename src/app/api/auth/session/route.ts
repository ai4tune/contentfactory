import { NextResponse } from "next/server";
import { getDataWorkspaceId } from "@/lib/data-workspace";
import { getWorkspaceMembership } from "@/lib/supabase/authorization";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export async function GET() {
  const membership = isSupabaseAuthConfigured() ? await getWorkspaceMembership() : null;
  return NextResponse.json({ workspaceId: await getDataWorkspaceId() ?? "local", email: membership?.email }, {
    headers: { "Cache-Control": "no-store" },
  });
}
