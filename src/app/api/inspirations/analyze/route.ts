import { NextResponse } from "next/server";
import { analyzeInspiration } from "@/lib/ai";
import {
  formatInspirationMetrics,
  InspirationValidationError,
  parseInspirationCaptureInput,
} from "@/modules/inspirations/normalization";
import { upsertInspiration } from "@/modules/inspirations/service";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const accountContext = await getActiveAccountContext();
    const input = parseInspirationCaptureInput(body, {
      captureMethod: "manual",
      accountPosition: accountContext?.accountPosition,
    });
    const result = await analyzeInspiration({
      platform: input.platform,
      sourceUrl: input.sourceUrl,
      title: input.title,
      metrics: formatInspirationMetrics(input.metrics, input.metricsSummary),
      sourceKeyword: input.sourceKeyword,
      content: input.content,
      accountPosition: input.accountPosition,
    });
    const saved = await upsertInspiration(input, result);

    return NextResponse.json({ result, ...saved });
  } catch (error) {
    if (error instanceof InspirationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inspiration analysis failed" },
      { status: 500 },
    );
  }
}
