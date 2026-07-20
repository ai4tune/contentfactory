import { NextResponse } from "next/server";
import { analyzePositioning, type PositioningRequest } from "@/lib/ai";
import { saveAccountProfile } from "@/lib/store";
import { getCurrentAccountProfile } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentAccountProfile();

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PositioningRequest;

    if (!body.business?.trim() || !body.audience?.trim() || !body.offer?.trim()) {
      return NextResponse.json(
        { error: "Business, audience, and offer are required" },
        { status: 400 },
      );
    }

    const input = {
      accountName: body.accountName || "未命名账号",
      business: body.business,
      audience: body.audience,
      offer: body.offer,
      differentiator: body.differentiator,
      platforms: body.platforms,
      goal: body.goal,
      currentContent: body.currentContent,
    };
    const result = await analyzePositioning(input);
    const record = await saveAccountProfile(input, result);

    return NextResponse.json({ result, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Positioning analysis failed" },
      { status: 500 },
    );
  }
}
