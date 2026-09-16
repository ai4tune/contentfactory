import { NextRequest, NextResponse } from "next/server";
import { getOperationSummary } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rawDays = Number(request.nextUrl.searchParams.get("days") || 7);
  const days = Number.isFinite(rawDays) ? rawDays : 7;
  return NextResponse.json(getOperationSummary(days));
}
