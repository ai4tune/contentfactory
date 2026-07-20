import { NextResponse } from "next/server";
import { analyzeTopicRadar, type TopicRadarRequest } from "@/lib/ai";
import { saveTopicRadar } from "@/lib/store";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TopicRadarRequest;
    const accountContext = await getActiveAccountContext();
    const accountPosition = body.accountPosition?.trim() || accountContext?.accountPosition || "未设置账号定位";

    const input = {
      accountPosition,
      targetAudience: body.targetAudience || accountContext?.targetAudience.join("、"),
      offer: body.offer || accountContext?.offer,
      platforms: body.platforms || accountContext?.platforms.join("、"),
      keywordSeeds: body.keywordSeeds,
      hotSamples: body.hotSamples,
      contentGoal: body.contentGoal || accountContext?.conversionGoal,
      accountContext: accountContext ?? undefined,
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
