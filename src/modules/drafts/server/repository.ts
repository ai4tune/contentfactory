import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { isContentChannel, type ContentChannel, type ContentProject } from "@/modules/content/types";
import { normalizeBriefList } from "@/modules/content/server/normalize-brief-list";
import type {
  ContentDraft,
  DraftFilters,
  DraftListItem,
  DraftReviewStatus,
  DraftVersion,
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

export async function updateContentDraft(input: {
  draftId: string;
  channel: ContentChannel;
  content: string;
}): Promise<ContentDraft | null> {
  const nextContent = input.content;
  let updatedDraft: ContentDraft | null = null;

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
  return {
    ...project,
    brief: {
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

async function readProjectStore() {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  return { projects: Array.isArray(store.projects) ? store.projects : [] };
}
