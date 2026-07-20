import { NextResponse } from "next/server";
import { generateChannelDraft } from "@/modules/content/channel-service";
import { saveChannelDrafts, saveContentProject } from "@/modules/content/server/project-repository";
import { normalizeContentBrief, normalizeKnowledgeSources } from "@/modules/content/server/request";
import {
  isContentChannel,
  type ChannelDraft,
  type GenerateChannelsRequest,
} from "@/modules/content/types";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateChannelsRequest;
    const topic = body.topic?.trim();
    const channels = Array.from(new Set(Array.isArray(body.channels) ? body.channels : []));
    const brief = normalizeContentBrief(body.brief);
    const sources = normalizeKnowledgeSources(body.sources);

    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    if (!channels.length || !channels.every(isContentChannel)) {
      return NextResponse.json({ error: "At least one valid channel is required" }, { status: 400 });
    }
    if (!brief) {
      return NextResponse.json({ error: "A content brief for the current topic is required" }, { status: 400 });
    }

    const accountContext = await getActiveAccountContext();
    const settled = await Promise.allSettled(
      channels.map((channel) =>
        generateChannelDraft({ channel, brief, sources, accountContext }),
      ),
    );
    const now = new Date().toISOString();
    const channelDrafts: ChannelDraft[] = settled.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            channel: channels[index],
            content: "",
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "Generation failed",
            updatedAt: now,
          },
    );
    const project = body.projectId
      ? await saveChannelDrafts(body.projectId, channels, channelDrafts)
      : await saveContentProject({ topic, accountSnapshot: accountContext, brief, channels, channelDrafts });

    if (!project) return NextResponse.json({ error: "Content project not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
