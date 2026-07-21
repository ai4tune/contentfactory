import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { applyReviewIssue, ReviewUpdateError } from "@/modules/reviews/server/repository";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; channel: string; issueId: string }> },
) {
  try {
    const { id, channel, issueId } = await context.params;
    if (!isContentChannel(channel)) {
      return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
    }
    if (!issueId.trim()) {
      return NextResponse.json({ error: "Review issue is required" }, { status: 400 });
    }

    const project = await applyReviewIssue(id, channel, issueId);
    return NextResponse.json({ project });
  } catch (error) {
    const status = error instanceof ReviewUpdateError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review suggestion could not be applied" },
      { status },
    );
  }
}
