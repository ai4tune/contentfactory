import { NextResponse } from "next/server";
import { getKnowledgeProfileState, saveKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { normalizeKnowledgeProfileInput } from "@/modules/knowledge-profile/service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getKnowledgeProfileState());
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      action?: unknown;
      profile?: unknown;
    };
    if (body.action !== "save" && body.action !== "confirm") {
      return NextResponse.json({ error: "action 必须是 save 或 confirm。" }, { status: 400 });
    }
    const raw = body.profile && typeof body.profile === "object"
      ? body.profile as Record<string, unknown>
      : {};
    const sources = Array.isArray(raw.sources) ? raw.sources.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const source = value as Record<string, unknown>;
      const sourceType = source.sourceType;
      if (!["local", "feishu", "base", "upload"].includes(String(sourceType))) return [];
      return [{
        id: String(source.id ?? ""),
        title: String(source.title ?? ""),
        source: sourceType as "local" | "feishu" | "base" | "upload",
        url: source.url ? String(source.url) : undefined,
        path: source.path ? String(source.path) : undefined,
      }];
    }) : [];
    const allowedSourceIds = new Set(sources.map((source) => source.id));
    const invalidConfirmedFacts = Array.isArray(raw.facts) ? raw.facts.filter((value) => {
      if (!value || typeof value !== "object") return false;
      const fact = value as Record<string, unknown>;
      if (fact.confidence !== "confirmed") return false;
      const sourceIds = Array.isArray(fact.sourceIds) ? fact.sourceIds.map(String) : [];
      return !sourceIds.length || sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId));
    }) : [];
    if (body.action === "confirm" && invalidConfirmedFacts.length) {
      return NextResponse.json(
        { error: `有 ${invalidConfirmedFacts.length} 条已确认事实缺少有效来源，请补充引用或标记为待确认。` },
        { status: 400 },
      );
    }
    const profile = normalizeKnowledgeProfileInput(raw, sources);
    const saved = await saveKnowledgeProfile(profile, body.action === "confirm" ? "confirmed" : "draft");
    return NextResponse.json({ profile: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "企业知识档案保存失败。" },
      { status: 400 },
    );
  }
}
