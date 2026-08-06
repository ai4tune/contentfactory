import { NextResponse } from "next/server";
import { listStyleFeedback } from "@/modules/style-profile/server/feedback-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  return NextResponse.json({ feedback: await listStyleFeedback(limit) });
}
