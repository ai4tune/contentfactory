import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { dataFilePath } from "@/lib/data-directory";
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

const projectStorePath = dataFilePath("content-projects.local.json");
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
  id?: string;
  topic: string;
  brief: ContentBrief;
  contentPlanId?: string;
  contentPlanItemId?: string;
  accountSnapshot: AccountContext | null;
  styleSnapshot?: StyleContract | null;
  temporaryStyleInstructions?: string[];
  knowledgeProfileVersion?: number;
  channels?: ContentChannel[];
  channelDrafts?: ChannelDraft[];
}) {
  const now = new Date().toISOString();
  const project: ContentProject = {
    id: input.id ?? `contentProjects_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic: input.topic,
    sourceIdeaId: input.brief.ideaContext?.id,
    contentPlanId: input.contentPlanId,
    contentPlanItemId: input.contentPlanItemId,
    accountSnapshot: input.accountSnapshot,
    styleSnapshot: input.styleSnapshot ?? null,
    temporaryStyleInstructions: input.temporaryStyleInstructions,
    knowledgeProfileVersion: input.knowledgeProfileVersion,
    selectedKnowledgeRefs: input.brief.citations,
    brief: input.brief,
    channels: input.channels ?? [],
    channelDrafts: input.channelDrafts ?? [],
    status: getProjectStatus(input.channelDrafts ?? []),
    createdAt: now,
    updatedAt: now,
  };

  const saved = await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).some((current) => current.id === project.id) ? store.projects : [...(store.projects ?? []), project],
  }));
  return withStyleSnapshot(saved.projects.find((current) => current.id === project.id)!);
}

function withStyleSnapshot(project: StoredContentProject): StoredContentProject {
  return { ...project, styleSnapshot: project.styleSnapshot ?? null };
}

export async function replaceChannelDraft(
  projectId: string,
  draft: ChannelDraft,
  preserveGenerated = false,
): Promise<ContentProject | null> {
  let updatedProject: ContentProject | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== projectId) return project;
      if (preserveGenerated && project.channelDrafts.some((item) => item.channel === draft.channel && item.status === "generated")) {
        updatedProject = project;
        return project;
      }
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
): Promise<ContentProject | null> {
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
): Promise<ContentProject | null> {
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

export async function saveChannelPhotoPlan(projectId: string, channel: ContentChannel, photoPlan: NonNullable<ChannelDraft["photoPlan"]>) {
  return updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    ...store, projects: store.projects.map((project) => {
      if (project.id !== projectId) return project;
      const draft = project.channelDrafts.find((item) => item.channel === channel);
      if (!draft || draft.updatedAt !== photoPlan.basedOnContentUpdatedAt) throw new Error("正文已更新，实拍建议尚未保存，请基于新正文重试。");
      return { ...project, channelDrafts: project.channelDrafts.map((item) => item.channel === channel ? { ...item, photoPlan } : item), updatedAt: photoPlan.createdAt };
    }),
  }));
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
