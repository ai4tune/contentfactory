import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { isContentChannel, type ContentChannel, type ContentProject } from "@/modules/content/types";
import { normalizeBriefList } from "@/modules/content/server/normalize-brief-list";
import { normalizeContentBrief } from "@/modules/content/server/request";
import { appendStyleFeedback } from "@/modules/style-profile/server/feedback-repository";
import type { StyleContract } from "@/modules/style-profile/types";
import type {
  ContentLibraryItem,
  ContentPublication,
  ContentDraft,
  DraftFilters,
  DraftListItem,
  DraftReviewStatus,
  DraftVersion,
  PublicationMetrics,
} from "../types";

type ProjectStore = { projects: Array<ContentProject & Partial<ContentDraft>> };

const projectStorePath = path.join(process.cwd(), "data", "content-projects.local.json");
const emptyStore: ProjectStore = { projects: [] };

export async function listContentDrafts(filters: DraftFilters = {}): Promise<DraftListItem[]> {
  const store = await readProjectStore();
  const query = filters.query?.trim().toLocaleLowerCase("zh-CN");

  return store.projects
    .map(normalizeDraft)
    .filter((draft) => !query || draft.topic.toLocaleLowerCase("zh-CN").includes(query))
    .filter((draft) => !filters.channel || draft.channelDrafts.some((item) => item.channel === filters.channel))
    .filter((draft) => !filters.reviewStatus || draft.reviewStatus === filters.reviewStatus)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toListItem);
}

export async function getContentDraft(draftId: string): Promise<ContentDraft | null> {
  const store = await readProjectStore();
  const project = store.projects.find((item) => item.id === draftId);
  return project ? normalizeDraft(project) : null;
}

export async function listContentLibraryItems(): Promise<ContentLibraryItem[]> {
  const store = await readProjectStore();
  return store.projects
    .map(normalizeDraft)
    .flatMap((draft) => draft.channelDrafts
      .filter((channelDraft) => channelDraft.status === "generated")
      .map((channelDraft) => {
        const publication = draft.publications.find((item) => item.channel === channelDraft.channel);
        return {
          id: `${draft.id}:${channelDraft.channel}`,
          draftId: draft.id,
          topic: draft.topic,
          channel: channelDraft.channel,
          excerpt: createExcerpt(channelDraft.content),
          reviewStatus: draft.reviewStatus,
          publication,
          createdAt: draft.createdAt,
          updatedAt: publication?.updatedAt ?? channelDraft.updatedAt ?? draft.updatedAt,
        };
      }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function updateContentDraft(input: {
  draftId: string;
  channel: ContentChannel;
  content: string;
}): Promise<ContentDraft | null> {
  const nextContent = input.content;
  let updatedDraft: ContentDraft | null = null;
  let feedbackOriginalText = "";
  let feedbackStyleSnapshot: StyleContract | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== input.draftId) return project;

      const draft = normalizeDraft(project);
      const existingChannel = draft.channelDrafts.find((item) => item.channel === input.channel);
      if (!existingChannel) return project;
      if (existingChannel.content === nextContent) {
        updatedDraft = draft;
        return draft;
      }

      const now = new Date().toISOString();
      feedbackOriginalText = existingChannel.content;
      feedbackStyleSnapshot = draft.styleSnapshot;
      const version: DraftVersion = {
        id: `draftVersions_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        channel: input.channel,
        content: existingChannel.content,
        createdAt: existingChannel.updatedAt || draft.updatedAt,
      };
      updatedDraft = {
        ...draft,
        channelDrafts: draft.channelDrafts.map((item) =>
          item.channel === input.channel
            ? { ...item, content: nextContent, status: "generated", error: undefined, updatedAt: now }
            : item,
        ),
        reviewStatus: "editing",
        versions: [...draft.versions, version],
        updatedAt: now,
      };
      return updatedDraft;
    }),
  }));

  if (feedbackOriginalText) {
    await appendStyleFeedback({
      projectId: input.draftId,
      channel: input.channel,
      action: "human_edit",
      styleSnapshot: feedbackStyleSnapshot,
      originalText: feedbackOriginalText,
      revisedText: nextContent,
    });
  }

  return updatedDraft;
}

export async function updateContentDraftReviewStatus(
  draftId: string,
  reviewStatus: DraftReviewStatus,
): Promise<ContentDraft | null> {
  let updatedDraft: ContentDraft | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== draftId) return project;

      const draft = normalizeDraft(project);
      if (draft.reviewStatus === reviewStatus) {
        updatedDraft = draft;
        return draft;
      }

      updatedDraft = {
        ...draft,
        reviewStatus,
        updatedAt: new Date().toISOString(),
      };
      return updatedDraft;
    }),
  }));

  return updatedDraft;
}

export async function updateContentPublication(input: {
  draftId: string;
  channel: ContentChannel;
  url?: string;
  publishedAt: string;
  metrics: PublicationMetrics;
}): Promise<ContentDraft | null> {
  let updatedDraft: ContentDraft | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== input.draftId) return project;

      const draft = normalizeDraft(project);
      const channelDraft = draft.channelDrafts.find(
        (item) => item.channel === input.channel && item.status === "generated",
      );
      if (!channelDraft) return project;

      const now = new Date().toISOString();
      const publication: ContentPublication = {
        channel: input.channel,
        url: input.url,
        publishedAt: input.publishedAt,
        updatedAt: now,
        metrics: input.metrics,
      };
      updatedDraft = {
        ...draft,
        publications: [
          ...draft.publications.filter((item) => item.channel !== input.channel),
          publication,
        ],
        updatedAt: now,
      };
      return updatedDraft;
    }),
  }));

  return updatedDraft;
}

export function parseDraftFilters(values: {
  query?: unknown;
  channel?: unknown;
  reviewStatus?: unknown;
}): DraftFilters {
  const reviewStatus = isReviewStatus(values.reviewStatus) ? values.reviewStatus : undefined;
  return {
    query: typeof values.query === "string" ? values.query : undefined,
    channel: isContentChannel(values.channel) ? values.channel : undefined,
    reviewStatus,
  };
}

function normalizeDraft(project: ContentProject & Partial<ContentDraft>): ContentDraft {
  const normalizedBrief = normalizeContentBrief(project.brief);
  return {
    ...project,
    styleSnapshot: project.styleSnapshot ?? null,
    brief: normalizedBrief ?? {
      ...project.brief,
      keyPoints: normalizeBriefList(project.brief.keyPoints),
      outline: normalizeBriefList(project.brief.outline),
      openQuestions: normalizeBriefList(project.brief.openQuestions),
    },
    channels: Array.isArray(project.channels) ? project.channels : [],
    channelDrafts: Array.isArray(project.channelDrafts) ? project.channelDrafts : [],
    selectedKnowledgeRefs: Array.isArray(project.selectedKnowledgeRefs)
      ? project.selectedKnowledgeRefs
      : project.brief.citations ?? [],
    reviewStatus: isReviewStatus(project.reviewStatus) ? project.reviewStatus : "draft",
    versions: Array.isArray(project.versions) ? project.versions : [],
    publications: normalizePublications(project.publications),
  };
}

function toListItem(draft: ContentDraft): DraftListItem {
  return {
    id: draft.id,
    topic: draft.topic,
    channels: draft.channels,
    generatedChannels: draft.channelDrafts
      .filter((item) => item.status === "generated")
      .map((item) => item.channel),
    failedChannels: draft.channelDrafts
      .filter((item) => item.status === "failed")
      .map((item) => item.channel),
    reviewStatus: draft.reviewStatus,
    projectStatus: draft.status,
    knowledgeSourceCount: new Set(draft.selectedKnowledgeRefs.map((item) => item.sourceId)).size,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

function isReviewStatus(value: unknown): value is DraftReviewStatus {
  return value === "draft" || value === "editing" || value === "approved";
}

function normalizePublications(value: unknown): ContentPublication[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (!isContentChannel(record.channel)) return [];
    const publishedAt = normalizeDate(record.publishedAt);
    const updatedAt = normalizeDate(record.updatedAt);
    if (!publishedAt || !updatedAt) return [];
    const metrics = record.metrics && typeof record.metrics === "object"
      ? record.metrics as Record<string, unknown>
      : {};

    return [{
      channel: record.channel,
      url: optionalString(record.url),
      publishedAt,
      updatedAt,
      metrics: {
        views: normalizeCount(metrics.views),
        likes: normalizeCount(metrics.likes),
        saves: normalizeCount(metrics.saves),
        comments: normalizeCount(metrics.comments),
        replies: normalizeCount(metrics.replies),
      },
    }];
  });
}

function createExcerpt(content: string) {
  return content
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

async function readProjectStore() {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  return { projects: Array.isArray(store.projects) ? store.projects : [] };
}
