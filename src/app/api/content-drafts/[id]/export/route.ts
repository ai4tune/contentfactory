import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { renderDraftMarkdown } from "@/modules/drafts/server/export";
import { getContentDraft } from "@/modules/drafts/server/repository";
import { renderWechatDocument } from "@/modules/drafts/wechat-html";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const draft = await getContentDraft(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const channelValue = search.get("channel");
  if (channelValue && !isContentChannel(channelValue)) return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
  const channel = isContentChannel(channelValue) ? channelValue : undefined;
  if (search.get("format") === "html") {
    if (draft.reviewStatus !== "approved") return NextResponse.json({ error: "请先人工确认内容，再下载公众号排版。" }, { status: 409 });
    const current = draft.channelDrafts.find((item) => item.channel === "wechat_article" && item.status === "generated");
    if (channel !== "wechat_article" || !current) return NextResponse.json({ error: "请先生成公众号文章，再下载排版。" }, { status: 400 });
    return new NextResponse(renderWechatDocument(current.delivery?.title ?? draft.topic, current.content), { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="draft-${draft.id}.html"` } });
  }
  const markdown = renderDraftMarkdown(draft, channel);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="draft-${draft.id}.md"`,
    },
  });
}
