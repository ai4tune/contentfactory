import { NextResponse } from "next/server";
import { analyzeInspiration } from "@/lib/ai";
import {
  formatInspirationMetrics,
  InspirationValidationError,
  parseInspirationCaptureInput,
} from "@/modules/inspirations/normalization";
import { upsertInspiration } from "@/modules/inspirations/service";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { checkCaptureAccess } from "@/modules/positioning/capture-access";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  const access = checkCaptureAccess(request, true);
  return new NextResponse(null, {
    status: access.allowed ? 204 : 403,
    headers: access.corsHeaders,
  });
}

export async function POST(request: Request) {
  const access = checkCaptureAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Capture origin is not allowed" },
      { status: 403, headers: access.corsHeaders },
    );
  }
  try {
    const requestText = await request.text();
    if (requestText.length > 500_000) {
      return NextResponse.json(
        { error: "Capture payload is too large" },
        { status: 413, headers: access.corsHeaders },
      );
    }
    const body: unknown = JSON.parse(requestText);
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

    return NextResponse.json({ result, ...saved }, { headers: access.corsHeaders });
  } catch (error) {
    if (error instanceof InspirationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: access.corsHeaders });
    }
    const invalidJson = error instanceof SyntaxError;
    return NextResponse.json(
      { error: invalidJson ? "Invalid JSON payload" : error instanceof Error ? error.message : "Capture import failed" },
      { status: invalidJson ? 400 : 500, headers: access.corsHeaders },
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
