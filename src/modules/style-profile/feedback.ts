import type { ContentChannel } from "@/modules/content/types";

export type StyleFeedbackAction = "issue_applied" | "issue_ignored" | "human_edit";

export type StyleFeedbackRecord = {
  id: string;
  accountId: "current-account";
  profileId?: "current-style-profile";
  profileVersion?: number;
  projectId: string;
  channel: ContentChannel;
  action: StyleFeedbackAction;
  issueId?: string;
  issueTitle?: string;
  originalText: string;
  revisedText: string;
  createdAt: string;
};
