import { NextResponse } from "next/server";
import { analyzeEnterpriseKnowledge, normalizeKnowledgeProfileSources } from "@/modules/knowledge-profile/service";
import { saveKnowledgeProfile } from "@/modules/knowledge-profile/repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { sources?: unknown };
    const sources = normalizeKnowledgeProfileSources(body.sources);
    if (!sources.length) {
      return NextResponse.json({ error: "请至少选择一份有正文的知识资料。" }, { status: 400 });
    }
    const input = await analyzeEnterpriseKnowledge(sources);
    const profile = await saveKnowledgeProfile(input, "draft");
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "企业知识档案分析失败。" },
      { status: 500 },
    );
  }
}
