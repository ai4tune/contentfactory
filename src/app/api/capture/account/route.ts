import { NextResponse } from "next/server";
import { checkCaptureAccess } from "@/modules/positioning/capture-access";
import {
  captureToPositioningRequest,
  normalizeAccountCapture,
  normalizeCapturedDraft,
} from "@/modules/positioning/capture";
import {
  analyzeAccountContext,
  confirmCapturedAccountContext,
} from "@/modules/positioning/service";

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
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 100_000) {
      return NextResponse.json(
        { error: "Capture payload is too large" },
        { status: 413, headers: access.corsHeaders },
      );
    }

    const requestText = await request.text();
    if (requestText.length > 100_000) {
      return NextResponse.json(
        { error: "Capture payload is too large" },
        { status: 413, headers: access.corsHeaders },
      );
    }
    const body = JSON.parse(requestText) as { action?: unknown; capture?: unknown; draft?: unknown };

    if (body.action === "analyze") {
      const capture = normalizeAccountCapture(body.capture);
      if (!capture) {
        return NextResponse.json(
          { error: "A valid visible account capture is required" },
          { status: 400, headers: access.corsHeaders },
        );
      }
      const draft = await analyzeAccountContext(captureToPositioningRequest(capture), "capture");
      return NextResponse.json({ capture, draft }, { headers: access.corsHeaders });
    }

    if (body.action === "confirm") {
      const draft = normalizeCapturedDraft(body.draft);
      if (!draft) {
        return NextResponse.json(
          { error: "A valid positioning draft is required" },
          { status: 400, headers: access.corsHeaders },
        );
      }
      const context = await confirmCapturedAccountContext(draft);
      return NextResponse.json({ context }, { headers: access.corsHeaders });
    }

    return NextResponse.json(
      { error: "Action must be analyze or confirm" },
      { status: 400, headers: access.corsHeaders },
    );
  } catch (error) {
    const invalidJson = error instanceof SyntaxError;
    return NextResponse.json(
      { error: invalidJson ? "Invalid JSON payload" : error instanceof Error ? error.message : "Account capture failed" },
      { status: invalidJson ? 400 : 500, headers: access.corsHeaders },
    );
  }
}
