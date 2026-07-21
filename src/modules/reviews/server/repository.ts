import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { ContentChannel, ContentProject } from "@/modules/content/types";
import type { ChannelReview } from "../types";

type ProjectStore = { projects: ContentProject[] };

const projectStorePath = path.join(process.cwd(), "data", "content-projects.local.json");
const emptyStore: ProjectStore = { projects: [] };

export class ReviewUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ReviewUpdateError";
  }
}

export async function saveChannelReview(
  projectId: string,
  channel: ContentChannel,
  review: ChannelReview,
) {
  return updateChannel(projectId, channel, (project, draft) => {
    const now = new Date().toISOString();
    return {
      ...project,
      channelDrafts: project.channelDrafts.map((item) => item.channel === channel
        ? { ...draft, review, updatedAt: now }
        : item),
      updatedAt: now,
    };
  });
}

export async function saveEditedChannel(
  projectId: string,
  channel: ContentChannel,
  content: string,
) {
  const normalizedContent = content.trim();
  return updateChannel(projectId, channel, (project, draft) => {
    if (draft.content === normalizedContent) return project;
    const now = new Date().toISOString();
    return {
      ...project,
      channelDrafts: project.channelDrafts.map((item) => item.channel === channel
        ? { ...draft, content: normalizedContent, status: "generated", error: undefined, updatedAt: now }
        : item),
      updatedAt: now,
    };
  });
}

export async function applyReviewIssue(
  projectId: string,
  channel: ContentChannel,
  issueId: string,
) {
  return updateChannel(projectId, channel, (project, draft) => {
    const review = draft.review;
    const issue = review?.issues.find((item) => item.id === issueId);
    if (!review || !issue) throw new ReviewUpdateError("Review issue not found", 404);
    if (issue.status === "applied") return project;
    if (review.reviewedContent !== draft.content) {
      throw new ReviewUpdateError("The draft has changed. Run the review again before applying this suggestion", 409);
    }
    if (!issue.autoFixable || !issue.originalText || !issue.suggestedText) {
      throw new ReviewUpdateError("This review issue requires manual editing", 409);
    }

    const matchIndex = draft.content.indexOf(issue.originalText);
    if (matchIndex < 0) {
      throw new ReviewUpdateError("The draft has changed. Run the review again before applying this suggestion", 409);
    }

    const content = [
      draft.content.slice(0, matchIndex),
      issue.suggestedText,
      draft.content.slice(matchIndex + issue.originalText.length),
    ].join("");
    const now = new Date().toISOString();
    return {
      ...project,
      channelDrafts: project.channelDrafts.map((item) => item.channel === channel
        ? {
            ...draft,
            content,
            review: {
              ...review,
              reviewedContent: content,
              issues: review.issues.map((reviewIssue) => reviewIssue.id === issueId
                ? { ...reviewIssue, status: "applied" as const }
                : reviewIssue),
            },
            updatedAt: now,
          }
        : item),
      updatedAt: now,
    };
  });
}

async function updateChannel(
  projectId: string,
  channel: ContentChannel,
  update: (
    project: ContentProject,
    draft: ContentProject["channelDrafts"][number],
  ) => ContentProject,
) {
  let updatedProject: ContentProject | null = null;

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: (store.projects ?? []).map((project) => {
      if (project.id !== projectId) return project;
      const draft = project.channelDrafts.find((item) => item.channel === channel);
      if (!draft || draft.status !== "generated") {
        throw new ReviewUpdateError("Content project or generated channel draft not found", 404);
      }
      updatedProject = update(project, draft);
      return updatedProject;
    }),
  }));

  if (!updatedProject) throw new ReviewUpdateError("Content project not found", 404);
  return updatedProject;
}

export async function readReviewProject(projectId: string) {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  return (store.projects ?? []).find((project) => project.id === projectId) ?? null;
}
