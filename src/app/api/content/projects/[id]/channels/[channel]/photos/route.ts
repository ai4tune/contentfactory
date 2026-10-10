import { NextResponse } from "next/server";
import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { isContentChannel } from "@/modules/content/types";
import { getContentProject, saveChannelPhotoPlan } from "@/modules/content/server/project-repository";
import { parsePhotoSuggestions } from "@/modules/content/publication-delivery";
import { checkContentFacts, ContentFactError } from "@/modules/content/fact-check";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request, context: { params: Promise<{ id: string; channel: string }> }) {
  try {
    const { id, channel } = await context.params;
    if (!isContentChannel(channel)) return NextResponse.json({ error: "发布渠道无效。" }, { status: 400 });
    const project = await getContentProject(id);
    if (!project) return NextResponse.json({ error: "内容项目不存在。" }, { status: 404 });
    const draft = project.channelDrafts.find((item) => item.channel === channel && item.status === "generated");
    if (!draft) return NextResponse.json({ error: "请先生成并保存本渠道正文。" }, { status: 400 });
    const body = await request.json() as { expectedUpdatedAt?: unknown };
    if (body.expectedUpdatedAt !== draft.updatedAt) return NextResponse.json({ error: "正文已更新，请刷新后再准备实拍清单。" }, { status: 409 });
    const sources = project.selectedKnowledgeRefs.map((ref) => ({ id: ref.sourceId, title: ref.sourceTitle, text: ref.excerpt, source: ref.sourceType }));
    if (!sources.length) return NextResponse.json({ error: "请先补充可核对的真实业务资料。" }, { status: 400 });
    const result = parseJsonObject(await chatCompletionJson([
      { role: "system", content: '你是实拍素材顾问。只输出 {"photoSuggestions":[{"purpose":"用途","subject":"拍什么","how":"怎么拍","placement":"放哪里","fallback":"缺图时怎么办","sourceIds":["资料ID"]}]}。按本篇实际主题提供0–6条；不适合实拍则为空。只能建议由原始资料支持的对象。未知设施、顾客活动或场地必须写成明确的条件建议，不当作存在。标明缺图时补拍、缩减相关描述或用明确示意的文字卡片；AI图不能冒充实拍。人物照片避开可识别人脸或使用已获授权的素材。不能使用正文反推经营事实。' },
      { role: "user", content: JSON.stringify({ topic: project.topic, channel, content: draft.content, sources }) },
    ], { timeoutMs: 45_000 })) as Record<string, unknown>;
    if (!Array.isArray(result.photoSuggestions)) throw new Error("未获得实拍清单，请重试。");
    const suggestions = parsePhotoSuggestions(result.photoSuggestions, sources.map((source) => source.id));
    if (suggestions.length) {
      const issues = await checkContentFacts(JSON.stringify(suggestions), sources, project.accountSnapshot);
      if (issues.length) throw new ContentFactError("实拍建议涉及未确认信息，请补充真实资料后重试。");
    }
    await saveChannelPhotoPlan(id, channel, { suggestions, basedOnContentUpdatedAt: draft.updatedAt, createdAt: new Date().toISOString() });
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "实拍建议生成失败。" }, { status: error instanceof ContentFactError ? error.status : error instanceof Error && error.message.includes("正文已更新") ? 409 : 500 });
  }
}
