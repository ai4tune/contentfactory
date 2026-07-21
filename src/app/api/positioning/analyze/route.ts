import { NextResponse } from "next/server";
import type { PositioningRequest } from "@/lib/ai";
import { analyzeAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

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
    const draft = await analyzeAccountContext(input);

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Positioning analysis failed" },
      { status: 500 },
    );
  }
}
