import { NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getConfigStatus());
}
