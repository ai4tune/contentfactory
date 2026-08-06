import { NextResponse } from "next/server";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import {
  analyzeStyleProfile,
  normalizeStyleAnalysisSources,
} from "@/modules/style-profile/analyzer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sources?: unknown };
    const sources = normalizeStyleAnalysisSources(body.sources);
    if (!sources.length) {
      return NextResponse.json({ error: "请至少选择一份包含正文的风格资料。" }, { status: 400 });
    }

    const profile = await analyzeStyleProfile(sources, await getCurrentAccountContext());
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "风格分析失败" },
      { status: 500 },
    );
  }
}
