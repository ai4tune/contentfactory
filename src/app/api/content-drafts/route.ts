import { NextResponse } from "next/server";
import { listContentDrafts, parseDraftFilters } from "@/modules/drafts/server/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const drafts = await listContentDrafts(
    parseDraftFilters({
      query: url.searchParams.get("query"),
      channel: url.searchParams.get("channel"),
      reviewStatus: url.searchParams.get("reviewStatus"),
    }),
  );

  return NextResponse.json({ drafts });
}
