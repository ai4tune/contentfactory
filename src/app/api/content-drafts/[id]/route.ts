import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import {
  getContentDraft,
  updateContentDraft,
  updateContentDraftReviewStatus,
  DraftConflictError,
} from "@/modules/drafts/server/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const draft = await getContentDraft(id);
  return draft
    ? NextResponse.json({ draft })
    : NextResponse.json({ error: "Draft not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      channel?: unknown;
      content?: unknown;
      reviewStatus?: unknown;
      title?: unknown;
      expectedUpdatedAt?: unknown;
    };
    const current = await getContentDraft(id);
    if (!current) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (body.reviewStatus !== undefined) {
      if (body.reviewStatus !== "approved") {
        return NextResponse.json({ error: "Only approved review status is accepted" }, { status: 400 });
      }
      if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== current.updatedAt) throw new DraftConflictError();
      if (!current.channelDrafts.some((item) => item.status === "generated")) {
        return NextResponse.json({ error: "Generate at least one channel before approval" }, { status: 400 });
      }
      const draft = await updateContentDraftReviewStatus(id, "approved", typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined);
      return NextResponse.json({ draft });
    }
    if (!isContentChannel(body.channel)) {
      return NextResponse.json({ error: "A valid channel is required" }, { status: 400 });
    }
    if (!current.channelDrafts.some((item) => item.channel === body.channel)) return NextResponse.json({ error: "Draft or channel not found" }, { status: 404 });
    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "Draft content is required" }, { status: 400 });
    }
    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200)) return NextResponse.json({ error: "最终标题请填写 1–200 字。" }, { status: 400 });
    if (body.expectedUpdatedAt !== undefined && typeof body.expectedUpdatedAt !== "string") return NextResponse.json({ error: "稿件版本无效。" }, { status: 400 });

    const draft = await updateContentDraft({ draftId: id, channel: body.channel, content: body.content, title: typeof body.title === "string" ? body.title.trim() : undefined, expectedUpdatedAt: body.expectedUpdatedAt as string | undefined });
    return draft
      ? NextResponse.json({ draft })
      : NextResponse.json({ error: "Draft or channel not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft update failed" },
      { status: error instanceof DraftConflictError ? 409 : 500 },
    );
  }
}
