import { NextResponse } from "next/server";
import { analyzeInspiration, type InspirationRequest } from "@/lib/ai";
import { saveInspiration } from "@/lib/store";

export const runtime = "nodejs";

type CapturePayload = {
  platform?: string;
  sourceUrl?: string;
  title?: string;
  metrics?: string;
  sourceKeyword?: string;
  content?: string;
  accountPosition?: string;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CapturePayload;
    const input: InspirationRequest = {
      platform: body.platform || inferPlatform(body.sourceUrl),
      sourceUrl: body.sourceUrl,
      title: body.title || "未命名爆款样本",
      metrics: body.metrics,
      sourceKeyword: body.sourceKeyword,
      content: body.content || "",
      accountPosition: body.accountPosition,
    };

    if (!input.content.trim()) {
      return NextResponse.json({ error: "Captured content is empty" }, { status: 400 });
    }

    const result = await analyzeInspiration(input);
    const record = await saveInspiration(input, result);

    return NextResponse.json({ result, record });
  } catch (error) {
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
