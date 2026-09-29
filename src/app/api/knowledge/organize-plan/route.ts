import { NextResponse } from "next/server";
import { normalizeKnowledgeProfileSources } from "@/modules/knowledge-profile/service";
import { planKnowledgeOrganization } from "@/modules/knowledge/server/organization-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sources?: unknown };
    const sources = normalizeKnowledgeProfileSources(body.sources);
    if (!sources.length) {
      return NextResponse.json({ error: "请至少选择一份有正文的本地资料。" }, { status: 400 });
    }
    return NextResponse.json({ plan: await planKnowledgeOrganization(sources) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "知识库整理方案生成失败。" },
      { status: 500 },
    );
  }
}
