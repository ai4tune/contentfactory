import { NextResponse } from "next/server";
import { listInspirationRecords, toInspirationReference } from "@/modules/inspirations/service";
import type { InspirationFilters } from "@/modules/inspirations/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const usage = searchParams.get("usage");
    const filters: InspirationFilters = {
      platform: searchParams.get("platform") || undefined,
      sourceKeyword: searchParams.get("sourceKeyword") || undefined,
      usage: usage === "used" || usage === "unused" ? usage : undefined,
    };
    const inspirations = (await listInspirationRecords(filters)).map(record => ({ ...toInspirationReference(record), statusLabel: !record.content.body.trim() ? "待补充正文" : record.usage.analysisStatus === "completed" ? "已拆解" : "待拆解" }));
    return NextResponse.json({ inspirations, total: inspirations.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "爆款库读取失败。" },
      { status: 500 },
    );
  }
}
