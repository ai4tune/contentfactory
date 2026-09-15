import { NextResponse } from "next/server";
import { parseQuickKnowledgeRequest, QuickRequestError } from "@/modules/content/quick/request";
import { recommendQuickKnowledge } from "@/modules/content/quick/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = parseQuickKnowledgeRequest(await request.json().catch(() => ({})));
    return NextResponse.json({ recommendations: await recommendQuickKnowledge(input) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "企业资料匹配失败。" },
      { status: error instanceof QuickRequestError ? error.status : 500 },
    );
  }
}
