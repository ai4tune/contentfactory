import { NextResponse } from "next/server";
import { getCurrentContentPlan } from "@/modules/plans/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ plan: await getCurrentContentPlan() });
}
