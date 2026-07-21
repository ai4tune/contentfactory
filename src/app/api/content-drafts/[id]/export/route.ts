import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { renderDraftMarkdown } from "@/modules/drafts/server/export";
import { getContentDraft } from "@/modules/drafts/server/repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const draft = await getContentDraft(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const channelValue = new URL(request.url).searchParams.get("channel");
  const channel = isContentChannel(channelValue) ? channelValue : undefined;
  const markdown = renderDraftMarkdown(draft, channel);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="draft-${draft.id}.md"`,
    },
  });
}
