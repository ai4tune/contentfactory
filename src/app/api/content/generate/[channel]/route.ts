import { NextResponse } from "next/server";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { replaceChannelDraft } from "@/modules/content/server/project-repository";
import { normalizeContentBrief, normalizeKnowledgeSources } from "@/modules/content/server/request";
import { isContentChannel, type GenerateChannelsRequest } from "@/modules/content/types";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ channel: string }> },
) {
  try {
    const { channel } = await context.params;
    const body = (await request.json()) as GenerateChannelsRequest;
    const topic = body.topic?.trim();
    const brief = normalizeContentBrief(body.brief);

    if (!isContentChannel(channel)) {
      return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
    }
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    if (!brief) {
      return NextResponse.json({ error: "A content brief for the current topic is required" }, { status: 400 });
    }

    const sources = normalizeKnowledgeSources(body.sources);
    const accountContext = await getActiveAccountContext();
    const draft = await generateChannelDraft({ channel, brief, sources, accountContext });

    if (body.projectId) {
      const project = await replaceChannelDraft(body.projectId, draft);
      if (!project) return NextResponse.json({ error: "Content project not found" }, { status: 404 });
      return NextResponse.json({ draft, project });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
