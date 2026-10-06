import { NextResponse } from "next/server";
import { analyzeEnterpriseKnowledge, normalizeKnowledgeProfileSources } from "@/modules/knowledge-profile/service";
import { saveKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { knowledgeTaskError } from "@/modules/knowledge/tasks/errors";

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
      { error: knowledgeTaskError(error) },
      { status: 500 },
    );
  }
}
