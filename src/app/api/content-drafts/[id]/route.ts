import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import {
  getContentDraft,
  updateContentDraft,
  updateContentDraftReviewStatus,
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
    };
    if (body.reviewStatus !== undefined) {
      if (body.reviewStatus !== "approved") {
        return NextResponse.json({ error: "Only approved review status is accepted" }, { status: 400 });
      }
      const current = await getContentDraft(id);
      if (!current) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }
      if (!current.channelDrafts.some((item) => item.status === "generated")) {
        return NextResponse.json({ error: "Generate at least one channel before approval" }, { status: 400 });
      }
      const draft = await updateContentDraftReviewStatus(id, "approved");
      return NextResponse.json({ draft });
    }
    if (!isContentChannel(body.channel)) {
      return NextResponse.json({ error: "A valid channel is required" }, { status: 400 });
    }
    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "Draft content is required" }, { status: 400 });
    }

    const draft = await updateContentDraft({ draftId: id, channel: body.channel, content: body.content });
    return draft
      ? NextResponse.json({ draft })
      : NextResponse.json({ error: "Draft or channel not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft update failed" },
      { status: 500 },
    );
  }
}
