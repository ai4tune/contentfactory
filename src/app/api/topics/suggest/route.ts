import { NextResponse } from "next/server";
import { normalizeKnowledgeSources } from "@/modules/content/server/request";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { suggestTopics } from "@/modules/topics/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sources?: unknown };
    const sources = normalizeKnowledgeSources(body.sources);
    if (!sources.length) {
      return NextResponse.json({ error: "请至少选择 1 份包含正文的知识资料。" }, { status: 400 });
    }

    const suggestions = await suggestTopics(await getActiveAccountContext(), sources);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "选题推荐失败" },
      { status: 500 },
    );
  }
}
