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

export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const record = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    const accountContext = await getActiveAccountContext();
    const input = parseInspirationCaptureInput({
      ...record,
      platform: record.platform || inferPlatform(typeof record.sourceUrl === "string" ? record.sourceUrl : undefined),
    }, {
      captureMethod: "plugin",
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
      { error: error instanceof Error ? error.message : "Capture import failed" },
      { status: 500 },
    );
  }
}

function inferPlatform(url?: string) {
  if (!url) {
    return "未知平台";
  }

  try {
    const host = new URL(url).hostname;

    if (host.includes("xiaohongshu")) {
      return "小红书";
    }

    if (host.includes("weixin.qq.com")) {
      return "公众号";
    }

    if (host.includes("douyin")) {
      return "抖音";
    }

    return host;
  } catch {
    return "未知平台";
  }
}
