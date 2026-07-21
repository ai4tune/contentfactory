import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { ReviewUpdateError, saveEditedChannel } from "@/modules/reviews/server/repository";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; channel: string }> },
) {
  try {
    const { id, channel } = await context.params;
    if (!isContentChannel(channel)) {
      return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
    }

    const body = (await request.json()) as { content?: unknown };
    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "Draft content is required" }, { status: 400 });
    }
    if (body.content.length > 100_000) {
      return NextResponse.json({ error: "Draft content is too long" }, { status: 400 });
    }

    const project = await saveEditedChannel(id, channel, body.content);
    return NextResponse.json({ project });
  } catch (error) {
    return handleReviewError(error, "Draft update failed");
  }
}

function handleReviewError(error: unknown, fallback: string) {
  const status = error instanceof ReviewUpdateError ? error.status : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status },
  );
}
