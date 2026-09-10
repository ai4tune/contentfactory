import { NextResponse } from "next/server";
import { getInspirationRecord, toInspirationReference } from "@/modules/inspirations/service";
import { updateStore } from "@/lib/store";
import { analyzeInspiration } from "@/lib/ai";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (typeof body?.content !== "string" || body.content.length > 100000) return NextResponse.json({ error: "正文须为不超过 10 万字的文本" }, { status: 400 });
  if (!await getInspirationRecord(id)) return NextResponse.json({ error: "爆款不存在" }, { status: 404 });
  await updateStore(store => ({ ...store, inspirations: store.inspirations.map(item => item.id !== id || item.content.body === body.content ? item : {
    ...item, updatedAt: new Date().toISOString(), content: { ...item.content, body: body.content },
    usage: { ...item.usage, analysisStatus: "pending" },
    analysis: { ...item.analysis, summary: "", targetAudience: "", painPoint: "", hook: "", pacing: "", evidence: [], callToAction: "", structure: [], reusablePatterns: [], adaptationIdeas: [], topicCandidates: [], riskNotes: [] },
  }) }));
  return NextResponse.json({ success: true });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getInspirationRecord(id);
  if (!record) return NextResponse.json({ error: "爆款不存在" }, { status: 404 });
  if (!record.content.body.trim()) return NextResponse.json({ error: "请先补充并保存正文，再进行 AI 拆解" }, { status: 400 });
  try {
    const account = await getActiveAccountContext();
    const result = await analyzeInspiration({ platform: record.source.platform, title: record.content.title, content: record.content.body, sourceUrl: record.source.sourceUrl, sourceKeyword: record.discovery.sourceKeyword, accountPosition: account?.accountPosition });
    let stale = false;
    await updateStore(store => ({ ...store, inspirations: store.inspirations.map(item => {
      if (item.id !== id) return item;
      if (item.content.body !== record.content.body) { stale = true; return item; }
      return { ...item, updatedAt: new Date().toISOString(), analysis: result, usage: { ...item.usage, analysisStatus: "completed" } };
    }) }));
    if (stale) return NextResponse.json({ error: "正文已变更，请重新拆解" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "拆解失败" }, { status: 500 }); }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const record = await getInspirationRecord(id);
    if (!record) return NextResponse.json({ error: "爆款不存在" }, { status: 404 });
    return NextResponse.json({ inspiration: record, reference: toInspirationReference(record) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "爆款详情读取失败" },
      { status: 500 },
    );
  }
}
