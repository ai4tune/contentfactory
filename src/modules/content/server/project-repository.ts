import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { AccountContext } from "@/modules/positioning/types";
import type {
  ChannelDraft,
  ContentBrief,
  ContentChannel,
  ContentProject,
  GeneratedVisualAsset,
} from "../types";
import type { DraftReviewStatus } from "@/modules/drafts/types";
import type { StyleContract } from "@/modules/style-profile/types";

type StoredContentProject = ContentProject & { reviewStatus?: DraftReviewStatus };
type ProjectStore = { projects: StoredContentProject[] };

const projectStorePath = path.join(process.cwd(), "data", "content-projects.local.json");
const emptyStore: ProjectStore = { projects: [] };

export async function listContentProjects() {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  return store.projects ?? [];
}

export async function getContentProject(projectId: string) {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  const project = (store.projects ?? []).find((item) => item.id === projectId);
  return project ? withStyleSnapshot(project) : null;
}

export async function saveContentProject(input: {
  topic: string;
  brief: ContentBrief;
  accountSnapshot: AccountContext | null;
  styleSnapshot?: StyleContract | null;
  channels?: ContentChannel[];
  channelDrafts?: ChannelDraft[];
}) {
  const now = new Date().toISOString();
  const project: ContentProject = {
    id: `contentProjects_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic: input.topic,
    sourceIdeaId: input.brief.ideaContext?.id,
    accountSnapshot: input.accountSnapshot,
    styleSnapshot: input.styleSnapshot ?? null,
    selectedKnowledgeRefs: input.brief.citations,
    brief: input.brief,
    channels: input.channels ?? [],
    channelDrafts: input.channelDrafts ?? [],
    status: getProjectStatus(input.channelDrafts ?? []),
    createdAt: now,
    updatedAt: now,
  };

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: [...(store.projects ?? []), project],
  }));
  return project;
}

function withStyleSnapshot(project: StoredContentProject): StoredContentProject {
  return { ...project, styleSnapshot: project.styleSnapshot ?? null };
}

export async function replaceChannelDraft(projectId: string, draft: ChannelDraft) {
  let updatedProject: ContentProject | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== projectId) return project;
      const channelDrafts = [...(project.channelDrafts ?? []).filter((item) => item.channel !== draft.channel), draft];
      updatedProject = {
        ...project,
        channels: project.channels.includes(draft.channel) ? project.channels : [...project.channels, draft.channel],
        channelDrafts,
        status: getProjectStatus(channelDrafts),
        ...invalidateApproval(project),
        updatedAt: new Date().toISOString(),
      };
      return updatedProject;
    }),
  }));

  return updatedProject;
}

export async function saveChannelDrafts(
  projectId: string,
  channels: ContentChannel[],
  channelDrafts: ChannelDraft[],
) {
  let updatedProject: ContentProject | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== projectId) return project;
      const generatedChannels = new Set(channels);
      const drafts = [
        ...(project.channelDrafts ?? []).filter((draft) => !generatedChannels.has(draft.channel)),
        ...channelDrafts,
      ];
      updatedProject = {
        ...project,
        channels: Array.from(new Set([...project.channels, ...channels])),
        channelDrafts: drafts,
        status: getProjectStatus(drafts),
        ...invalidateApproval(project),
        updatedAt: new Date().toISOString(),
      };
      return updatedProject;
    }),
  }));

  return updatedProject;
}

export async function saveChannelVisualAssets(
  projectId: string,
  channel: ContentChannel,
  visualAssets: GeneratedVisualAsset[],
) {
  let updatedProject: ContentProject | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== projectId) return project;
      const channelDrafts = (project.channelDrafts ?? []).map((draft) =>
        draft.channel === channel ? { ...draft, visualAssets } : draft,
      );
      updatedProject = {
        ...project,
        channelDrafts,
        ...invalidateApproval(project),
        updatedAt: new Date().toISOString(),
      };
      return updatedProject;
    }),
  }));

  return updatedProject;
}

function getProjectStatus(drafts: ChannelDraft[]): ContentProject["status"] {
  if (!drafts.length) return "brief_confirmed";
  if (drafts.every((draft) => draft.status === "failed")) return "failed";
  return drafts.some((draft) => draft.status === "failed") ? "partially_failed" : "generated";
}

function invalidateApproval(project: StoredContentProject) {
  return project.reviewStatus === "approved"
    ? { reviewStatus: "editing" as const }
    : {};
}
