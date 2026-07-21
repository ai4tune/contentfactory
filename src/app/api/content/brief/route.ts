import { NextResponse } from "next/server";
import { createContentBrief } from "@/modules/content/server/brief-service";
import { normalizeKnowledgeSources } from "@/modules/content/server/request";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { topic?: unknown; sources?: unknown };
    const topic = String(body.topic ?? "").trim();
    const sources = normalizeKnowledgeSources(body.sources);
    if (!topic || !sources.length) {
      return NextResponse.json(
        { error: "选题和至少 1 份包含正文的知识资料为必填项。" },
        { status: 400 },
      );
    }

    const brief = await createContentBrief(topic, await getActiveAccountContext(), sources);
    return NextResponse.json({ brief });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容简报生成失败" },
      { status: 500 },
    );
  }
}
