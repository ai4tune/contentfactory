import { NextResponse } from "next/server";
import { analyzeTopicRadar, type TopicRadarRequest } from "@/lib/ai";
import { saveTopicRadar, readStore } from "@/lib/store";
import { getInspirationRecord } from "@/modules/inspirations/service";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json({ record: (await readStore()).topicRadars.at(-1) || null }); }
  catch { return NextResponse.json({ error: "推荐历史读取失败" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TopicRadarRequest & { sampleIds?: string[] };
    if (body.sampleIds && (!Array.isArray(body.sampleIds) || body.sampleIds.length > 5 || body.sampleIds.some(id => typeof id !== "string"))) return NextResponse.json({ error: "最多选择 5 篇爆款" }, { status: 400 });
    const samples = await Promise.all((body.sampleIds || []).map(id => getInspirationRecord(id)));
    const accountContext = await getActiveAccountContext();
    const accountPosition = body.accountPosition?.trim() || accountContext?.accountPosition || "未设置账号定位";

    const input = {
      accountPosition,
      targetAudience: body.targetAudience || accountContext?.targetAudience.join("、"),
      offer: body.offer || accountContext?.offer,
      platforms: body.platforms || accountContext?.platforms.join("、"),
      keywordSeeds: body.keywordSeeds,
      hotSamples: [body.hotSamples || "", ...samples.filter(sample => sample !== null).map(sample => `外部参考（不是企业事实）：${sample.content.title}\n${sample.content.body.slice(0, 3000) || "未提供正文，仅参考标题"}\n可迁移结构：${sample.analysis.structure.join("；")}`)].join("\n\n"),
      contentGoal: body.contentGoal || accountContext?.conversionGoal,
      accountContext: accountContext ?? undefined,
    };
    const result = await analyzeTopicRadar(input);
    const record = await saveTopicRadar({ ...input, hotSamples: body.hotSamples || "", sampleIds: body.sampleIds || [] }, result);

    return NextResponse.json({ result, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Topic radar failed" },
      { status: 500 },
    );
  }
}
