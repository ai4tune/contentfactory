import { NextResponse } from "next/server";
import { generateChannelDraft } from "@/modules/content/channel-service";
import {
  getContentProject,
  replaceChannelDraft,
} from "@/modules/content/server/project-repository";
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
    const existingProject = body.projectId ? await getContentProject(body.projectId) : null;
    if (body.projectId && !existingProject) {
      return NextResponse.json({ error: "Content project not found" }, { status: 404 });
    }

    const topic = existingProject?.topic ?? body.topic?.trim();
    const brief = existingProject?.brief ?? normalizeContentBrief(body.brief);

    if (!isContentChannel(channel)) {
      return NextResponse.json({ error: "Unknown content channel" }, { status: 400 });
    }
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    if (!brief) {
      return NextResponse.json({ error: "A content brief for the current topic is required" }, { status: 400 });
    }

    const sources = normalizeKnowledgeSources(body.sources);
    const sourceIds = new Set(sources.map((source) => source.id));
    if (!sources.length || !brief.citations.every((citation) => sourceIds.has(citation.sourceId))) {
      return NextResponse.json({ error: "The knowledge sources used by this brief are required" }, { status: 400 });
    }

    const accountContext = existingProject?.accountSnapshot ?? await getActiveAccountContext();
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
