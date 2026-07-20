import { NextResponse } from "next/server";
import { analyzeTopicRadar, type TopicRadarRequest } from "@/lib/ai";
import { getCurrentAccountProfile, saveTopicRadar } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TopicRadarRequest;
    const profile = await getCurrentAccountProfile();
    const accountPosition = body.accountPosition?.trim() || profile?.result.accountPosition;

    if (!accountPosition) {
      return NextResponse.json({ error: "请先完成账号定位" }, { status: 400 });
    }

    const input = {
      accountPosition,
      targetAudience: body.targetAudience || profile?.result.targetAudience.join("、"),
      offer: body.offer || profile?.input.offer,
      platforms: body.platforms || profile?.input.platforms,
      keywordSeeds: body.keywordSeeds || profile?.result.keywordSeeds.join("、"),
      hotSamples: body.hotSamples,
      contentGoal: body.contentGoal,
    };
    const result = await analyzeTopicRadar(input);
    const record = await saveTopicRadar(input, result);

    return NextResponse.json({ result, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Topic radar failed" },
      { status: 500 },
    );
  }
}
