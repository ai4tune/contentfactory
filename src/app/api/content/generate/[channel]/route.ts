import { NextResponse } from "next/server";
import { generateChannelDraft } from "@/modules/content/channel-service";
import {
  getContentProject,
  replaceChannelDraft,
} from "@/modules/content/server/project-repository";
import { normalizeContentBrief, normalizeKnowledgeSources } from "@/modules/content/server/request";
import { isContentChannel, type BriefKnowledgeSource, type ContentCitation, type GenerateChannelsRequest } from "@/modules/content/types";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { normalizeTemporaryStyleInstructions } from "@/modules/style-profile/request";
import { getActiveStyleContract } from "@/modules/style-profile/service";
import { markPlanItemGenerated } from "@/modules/plans/repository";

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

    const suppliedSources = normalizeKnowledgeSources(body.sources);
    const sources = suppliedSources.length || !existingProject
      ? suppliedSources
      : sourcesFromCitations(brief.citations);
    const sourceIds = new Set(sources.map((source) => source.id));
    const hasRequiredKnowledge = brief.citations.length
      ? brief.citations.every((citation) => sourceIds.has(citation.sourceId))
      : Boolean(brief.inspiration);
    if (!hasRequiredKnowledge) {
      return NextResponse.json({ error: "The knowledge sources used by this brief are required" }, { status: 400 });
    }

    const [accountContext, styleContract] = existingProject
      ? [existingProject.accountSnapshot, existingProject.styleSnapshot]
      : await Promise.all([
          getActiveAccountContext(),
          getActiveStyleContract({
            temporaryInstructions: normalizeTemporaryStyleInstructions(body.temporaryStyleInstructions),
          }),
        ]);
    const draft = await generateChannelDraft({ channel, brief, sources, accountContext, styleContract });

    if (body.projectId) {
      const project = await replaceChannelDraft(body.projectId, draft);
      if (!project) return NextResponse.json({ error: "Content project not found" }, { status: 404 });
      if (project.contentPlanId && project.contentPlanItemId) {
        await markPlanItemGenerated(project.contentPlanId, project.contentPlanItemId, project.id);
      }
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

function sourcesFromCitations(citations: ContentCitation[]): BriefKnowledgeSource[] {
  const sources = new Map<string, BriefKnowledgeSource>();
  for (const citation of citations) {
    const existing = sources.get(citation.sourceId);
    if (existing) {
      if (!existing.text.includes(citation.excerpt)) existing.text += `\n\n${citation.excerpt}`;
      continue;
    }
    sources.set(citation.sourceId, {
      id: citation.sourceId,
      title: citation.sourceTitle,
      source: citation.sourceType,
      text: citation.excerpt,
      url: citation.url,
      path: citation.path,
    });
  }
  return [...sources.values()];
}
