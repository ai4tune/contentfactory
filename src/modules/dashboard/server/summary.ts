import { readStore } from "@/lib/store";
import { listContentDrafts, listContentLibraryItems } from "@/modules/drafts/server/repository";
import { listRemoteKnowledgeSources } from "@/modules/knowledge/server/source-store";
import { getCurrentAccountContext } from "@/modules/positioning/repository";

export async function getDashboardSummary() {
  const [store, drafts, contentItems, remoteKnowledgeSources, account] = await Promise.all([
    readStore(),
    listContentDrafts(),
    listContentLibraryItems(),
    listRemoteKnowledgeSources(),
    getCurrentAccountContext(),
  ]);
  const knowledgeSourceKeys = new Set([
    ...store.materials.map((source) => `${source.source}:${source.id}`),
    ...remoteKnowledgeSources.map((source) => `${source.source}:${source.id}`),
  ]);
  const publishedContent = contentItems.filter((item) => item.publication);
  const publicationMetrics = publishedContent.map((item) => item.publication!.metrics);

  return {
    account,
    serverKnowledgeCount: knowledgeSourceKeys.size,
    contentProjectCount: drafts.length,
    generatedContentCount: drafts.reduce(
      (total, draft) => total + draft.generatedChannels.length,
      0,
    ),
    approvedContentCount: drafts.filter((draft) => draft.reviewStatus === "approved").length,
    publishedContentCount: publishedContent.length,
    totalViews: publicationMetrics.reduce((total, metrics) => total + metrics.views, 0),
    totalLikes: publicationMetrics.reduce((total, metrics) => total + metrics.likes, 0),
    totalInteractions: publicationMetrics.reduce(
      (total, metrics) => total + metrics.likes + metrics.saves + metrics.comments + metrics.replies,
      0,
    ),
    recentDrafts: drafts.slice(0, 5),
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
