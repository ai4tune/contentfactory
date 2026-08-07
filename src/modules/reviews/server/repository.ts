import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { ContentChannel, ContentProject } from "@/modules/content/types";
import type { ChannelReview } from "../types";
import { appendStyleFeedback } from "@/modules/style-profile/server/feedback-repository";

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
  let originalContent = "";
  const project = await updateChannel(projectId, channel, (project, draft) => {
    if (draft.content === normalizedContent) return project;
    originalContent = draft.content;
    const now = new Date().toISOString();
    return {
      ...project,
      channelDrafts: project.channelDrafts.map((item) => item.channel === channel
        ? { ...draft, content: normalizedContent, status: "generated", error: undefined, updatedAt: now }
        : item),
      updatedAt: now,
    };
  });
  if (originalContent) {
    await appendStyleFeedback({
      projectId,
      channel,
      action: "human_edit",
      styleSnapshot: project.styleSnapshot,
      originalText: originalContent,
      revisedText: normalizedContent,
    });
  }
  return project;
}

export async function applyReviewIssue(
  projectId: string,
  channel: ContentChannel,
  issueId: string,
) {
  let appliedIssueId = "";
  let appliedIssueTitle = "";
  let appliedOriginalText = "";
  let appliedSuggestedText = "";
  const project = await updateChannel(projectId, channel, (project, draft) => {
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
    appliedIssueId = issue.id;
    appliedIssueTitle = issue.title;
    appliedOriginalText = issue.originalText;
    appliedSuggestedText = issue.suggestedText;
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
  if (appliedIssueId) {
    await appendStyleFeedback({
      projectId,
      channel,
      action: "issue_applied",
      styleSnapshot: project.styleSnapshot,
      issueId: appliedIssueId,
      issueTitle: appliedIssueTitle,
      originalText: appliedOriginalText,
      revisedText: appliedSuggestedText,
    });
  }
  return project;
}

export async function ignoreReviewIssue(
  projectId: string,
  channel: ContentChannel,
  issueId: string,
) {
  let ignoredIssueId = "";
  let ignoredIssueTitle = "";
  let ignoredOriginalText = "";
  const project = await updateChannel(projectId, channel, (project, draft) => {
    const review = draft.review;
    const issue = review?.issues.find((item) => item.id === issueId);
    if (!review || !issue) throw new ReviewUpdateError("Review issue not found", 404);
    if (issue.status !== "open") return project;
    if (review.reviewedContent !== draft.content) {
      throw new ReviewUpdateError("The draft has changed. Run the review again before ignoring this issue", 409);
    }
    ignoredIssueId = issue.id;
    ignoredIssueTitle = issue.title;
    ignoredOriginalText = issue.originalText;
    const now = new Date().toISOString();
    return {
      ...project,
      channelDrafts: project.channelDrafts.map((item) => item.channel === channel
        ? {
            ...draft,
            review: {
              ...review,
              issues: review.issues.map((reviewIssue) => reviewIssue.id === issueId
                ? { ...reviewIssue, status: "ignored" as const }
                : reviewIssue),
            },
            updatedAt: now,
          }
        : item),
      updatedAt: now,
    };
  });
  if (ignoredIssueId) {
    await appendStyleFeedback({
      projectId,
      channel,
      action: "issue_ignored",
      styleSnapshot: project.styleSnapshot,
      issueId: ignoredIssueId,
      issueTitle: ignoredIssueTitle,
      originalText: ignoredOriginalText,
      revisedText: ignoredOriginalText,
    });
  }
  return project;
}

async function updateChannel(
  projectId: string,
  channel: ContentChannel,
  update: (
    project: ContentProject,
    draft: ContentProject["channelDrafts"][number],
  ) => ContentProject,
): Promise<ContentProject> {
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
  return updatedProject as ContentProject;
}

export async function readReviewProject(projectId: string) {
  const store = await readJsonFile<ProjectStore>(projectStorePath, emptyStore);
  return (store.projects ?? []).find((project) => project.id === projectId) ?? null;
}
