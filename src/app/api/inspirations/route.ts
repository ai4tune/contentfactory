import { NextResponse } from "next/server";
import { listInspirationReferences } from "@/modules/inspirations/service";
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
    const inspirations = await listInspirationReferences(filters);
    return NextResponse.json({ inspirations, total: inspirations.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "爆款库读取失败。" },
      { status: 500 },
    );
  }
}
