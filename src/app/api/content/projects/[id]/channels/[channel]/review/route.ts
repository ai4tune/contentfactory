import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { ReviewUpdateError, readReviewProject, saveChannelReview } from "@/modules/reviews/server/repository";
import { reviewChannelDraft } from "@/modules/reviews/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; channel: string }> },
) {
  try {
    const { id, channel } = await context.params;
    const body = await request.json().catch(() => ({})) as { humanWritingQa?: unknown };
    if (!isContentChannel(channel)) {
      return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
    }

    const project = await readReviewProject(id);
    if (!project) return NextResponse.json({ error: "Content project not found" }, { status: 404 });
    const draft = project.channelDrafts.find((item) => item.channel === channel);
    if (!draft || draft.status !== "generated" || !draft.content.trim()) {
      return NextResponse.json({ error: "Generated channel draft not found" }, { status: 404 });
    }

    const review = await reviewChannelDraft({ project, draft, humanWritingQa: body.humanWritingQa === true });
    const updatedProject = await saveChannelReview(id, channel, review);
    return NextResponse.json({ project: updatedProject, review });
  } catch (error) {
    const status = error instanceof ReviewUpdateError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Content review failed" },
      { status },
    );
  }
}
