import { NextResponse } from "next/server";
import { analyzeInspiration, type InspirationRequest } from "@/lib/ai";
import { getCurrentAccountProfile, saveInspiration } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InspirationRequest;
    const profile = await getCurrentAccountProfile();

    if (!body.platform?.trim() || !body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json(
        { error: "Platform, title, and content are required" },
        { status: 400 },
      );
    }

    const input = {
      platform: body.platform,
      sourceUrl: body.sourceUrl,
      title: body.title,
      metrics: body.metrics,
      sourceKeyword: body.sourceKeyword,
      content: body.content,
      accountPosition: body.accountPosition || profile?.result.accountPosition,
    };
    const result = await analyzeInspiration(input);
    const record = await saveInspiration(input, result);

    return NextResponse.json({ result, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inspiration analysis failed" },
      { status: 500 },
    );
  }
}
