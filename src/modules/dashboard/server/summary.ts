import { localDate } from "@/modules/plans/calendar";
import { readStore } from "@/lib/store";
import { listContentDrafts, listContentLibraryItems } from "@/modules/drafts/server/repository";
import { listRemoteKnowledgeSources } from "@/modules/knowledge/server/source-store";
import { getCurrentContentPlan } from "@/modules/plans/repository";
import { getCurrentAccountContext } from "@/modules/positioning/repository";

export async function getDashboardSummary() {
  const [store, drafts, contentItems, remoteKnowledgeSources, account, contentPlan] = await Promise.all([
    readStore(),
    listContentDrafts(),
    listContentLibraryItems(),
    listRemoteKnowledgeSources(),
    getCurrentAccountContext(),
    getCurrentContentPlan(),
  ]);
  const knowledgeSourceKeys = new Set([
    ...store.materials.map((source) => `${source.source}:${source.id}`),
    ...remoteKnowledgeSources.map((source) => `${source.source}:${source.id}`),
  ]);
  const publishedContent = contentItems.filter((item) => item.publication);
  const publicationMetrics = publishedContent.map((item) => item.publication!.metrics);

  return {
    account,
    contentPlan,
    today: localDate(new Date(), contentPlan?.timeZone),
    drafts: drafts.map((draft) => ({ ...draft, publications: contentItems.filter((item) => item.draftId === draft.id && item.publication).map((item) => item.publication!) })),
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
