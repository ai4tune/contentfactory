import { NextResponse } from "next/server";
import { createContentBrief } from "@/modules/content/server/brief-service";
import { normalizeContentBrief, normalizeKnowledgeSources } from "@/modules/content/server/request";
import { getInspirationReference } from "@/modules/inspirations/service";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { normalizeTemporaryStyleInstructions } from "@/modules/style-profile/request";
import { getActiveStyleContract } from "@/modules/style-profile/service";
import { getIdeaContext } from "@/modules/ideas/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: unknown;
      sources?: unknown;
      inspirationId?: unknown;
      ideaId?: unknown;
      temporaryStyleInstructions?: unknown;
    };
    const topic = String(body.topic ?? "").trim();
    const sources = normalizeKnowledgeSources(body.sources);
    const ideaId = String(body.ideaId ?? "").trim();
    const ideaContext = ideaId ? await getIdeaContext(ideaId) : null;
    if (ideaId && !ideaContext) return NextResponse.json({ error: "选题不存在。" }, { status: 404 });
    const inspirationId = String(body.inspirationId ?? "").trim();
    const inspiration = await getInspirationReference(inspirationId);
    if (inspirationId && !inspiration) {
      return NextResponse.json({ error: "选择的爆款参考不存在。" }, { status: 404 });
    }
    if (!topic || (!sources.length && !inspiration)) {
      return NextResponse.json(
        { error: "请填写选题，并选择知识资料或一篇爆款参考。" },
        { status: 400 },
      );
    }

    const [account, styleContract] = await Promise.all([
      getActiveAccountContext(),
      getActiveStyleContract({
        temporaryInstructions: normalizeTemporaryStyleInstructions(body.temporaryStyleInstructions),
      }),
    ]);
    const brief = await createContentBrief(topic, account, sources, inspiration, styleContract, ideaContext);
    const normalizedBrief = normalizeContentBrief(brief);
    if (!normalizedBrief) {
      return NextResponse.json(
        { error: "AI 返回的简报不完整，请重新生成。需要包含目标受众、内容目标、核心观点、内容结构和知识引用。" },
        { status: 502 },
      );
    }
    return NextResponse.json({ brief });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容简报生成失败" },
      { status: 500 },
    );
  }
}
