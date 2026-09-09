import { getIdeaFromDb, getMarketItemFromDb, listIdeasFromDb } from "@/lib/db";
import { getInspirationRecord } from "@/modules/inspirations/service";
import { listContentProjects } from "@/modules/content/server/project-repository";
import type { ContentIdeaContext } from "@/modules/content/types";

export async function getIdeaContext(id: string): Promise<ContentIdeaContext | null> {
  const idea = getIdeaFromDb(id);
  if (!idea) return null;
  const marketItemId = text(idea.market_item_id);
  const inspirationId = text(idea.inspiration_id);
  const market = marketItemId ? getMarketItemFromDb(marketItemId) : null;
  const inspiration = inspirationId ? await getInspirationRecord(inspirationId) : null;
  return {
    id,
    title: String(idea.title),
    sourceUrl: text(idea.source_url),
    marketItemId,
    inspirationId,
    summary: inspiration?.analysis.summary || text(market?.summary) || text(idea.summary) || "",
    excerpt: (inspiration?.content.body || text(market?.body) || "").slice(0, 6000),
  };
}

export async function listIdeas(status?: string) {
  const projects = await listContentProjects();
  return listIdeasFromDb().map((idea) => {
    const contentProjectIds = projects.filter((project) => project.sourceIdeaId === idea.id).map((project) => project.id);
    return { ...idea, status: contentProjectIds.length ? "used" : "pool", contentProjectIds };
  }).filter((idea) => !status || idea.status === status);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
