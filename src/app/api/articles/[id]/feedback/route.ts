import { NextResponse } from "next/server";
import { contentChannels, type ContentChannel } from "@/modules/content/types";
import { getContentDraft, updateContentPublication } from "@/modules/drafts/server/repository";
import {
  parsePublicationFeedback,
  PublicationValidationError,
} from "@/modules/drafts/server/publication-request";
import { markPlanItemPublished } from "@/modules/plans/repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const identity = parseArticleId(id);
    if (!identity) {
      return NextResponse.json({ error: "内容标识无效。" }, { status: 400 });
    }

    const current = await getContentDraft(identity.draftId);
    if (!current || !current.channelDrafts.some(
      (item) => item.channel === identity.channel && item.status === "generated",
    )) {
      return NextResponse.json({ error: "没有找到对应的已生成内容。" }, { status: 404 });
    }
    if (current.reviewStatus !== "approved") {
      return NextResponse.json({ error: "请先完成人工审核并确认内容可发布。" }, { status: 409 });
    }
    const input = parsePublicationFeedback(await request.json().catch(() => ({})));
    const draft = await updateContentPublication({ ...identity, ...input });
    if (!draft) {
      return NextResponse.json({ error: "发布记录保存失败。" }, { status: 404 });
    }

    const publication = draft.publications.find((item) => item.channel === identity.channel);
    if (!publication) {
      return NextResponse.json({ error: "发布记录保存失败。" }, { status: 500 });
    }
    if (draft.contentPlanId && draft.contentPlanItemId) {
      await markPlanItemPublished(
        draft.contentPlanId,
        draft.contentPlanItemId,
        draft.id,
        publication.id,
      );
    }

    return NextResponse.json({ draft, publication });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发布反馈保存失败。" },
      { status: error instanceof PublicationValidationError ? 400 : 500 },
    );
  }
}

function parseArticleId(id: string): { draftId: string; channel: ContentChannel } | null {
  for (const channel of contentChannels) {
    const suffix = `:${channel}`;
    if (id.endsWith(suffix)) {
      const draftId = id.slice(0, -suffix.length);
      return draftId ? { draftId, channel } : null;
    }
  }
  return null;
}
