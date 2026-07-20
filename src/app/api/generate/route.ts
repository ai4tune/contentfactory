import { NextResponse } from "next/server";
import { generateContent, type GenerateRequest } from "@/lib/ai";
import { getCurrentAccountProfile, saveArticle } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const profile = await getCurrentAccountProfile();

    if (!body.topic?.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const input = {
      topic: body.topic,
      audience: body.audience,
      platform: body.platform,
      accountPosition: body.accountPosition || profile?.result.accountPosition,
      sources: Array.isArray(body.sources) ? body.sources : [],
    };
    const result = await generateContent(input);
    const record = await saveArticle(input, result);

    return NextResponse.json({ result, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
