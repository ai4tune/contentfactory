import path from "node:path";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { ContentChannel } from "@/modules/content/types";
import type { StyleContract } from "../types";
import type { StyleFeedbackAction, StyleFeedbackRecord } from "../feedback";

type FeedbackStore = { feedback: StyleFeedbackRecord[] };

const feedbackStorePath = path.join(process.cwd(), "data", "style-feedback.local.json");
const emptyStore: FeedbackStore = { feedback: [] };

export async function listStyleFeedback(limit = 100) {
  const store = await readJsonFile<FeedbackStore>(feedbackStorePath, emptyStore);
  return (store.feedback ?? [])
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

export async function appendStyleFeedback(input: {
  projectId: string;
  channel: ContentChannel;
  action: StyleFeedbackAction;
  styleSnapshot: StyleContract | null;
  issueId?: string;
  issueTitle?: string;
  originalText: string;
  revisedText: string;
}) {
  const originalText = input.originalText.trim().slice(0, 20_000);
  const revisedText = input.revisedText.trim().slice(0, 20_000);
  if (!originalText && !revisedText) return null;

  const record: StyleFeedbackRecord = {
    id: `styleFeedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: "current-account",
    profileId: input.styleSnapshot?.profileId,
    profileVersion: input.styleSnapshot?.profileVersion,
    projectId: input.projectId,
    channel: input.channel,
    action: input.action,
    issueId: input.issueId,
    issueTitle: input.issueTitle,
    originalText,
    revisedText,
    createdAt: new Date().toISOString(),
  };

  await updateJsonFile<FeedbackStore>(feedbackStorePath, emptyStore, (store) => ({
    feedback: [...(store.feedback ?? []), record].slice(-500),
  }));
  return record;
}
