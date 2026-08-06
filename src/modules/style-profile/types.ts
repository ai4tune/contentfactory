import type { ContentChannel } from "@/modules/content/types";

export const styleSourceTypes = ["local", "feishu", "github", "upload", "manual"] as const;
export type StyleSourceType = (typeof styleSourceTypes)[number];

export const styleSourceRoles = [
  "style_guide",
  "banned_phrases",
  "approved_sample",
  "edit_feedback",
] as const;
export type StyleSourceRole = (typeof styleSourceRoles)[number];

export const styleRuleCategories = ["identity", "narrative", "rhythm", "language", "boundary"] as const;
export type StyleRuleCategory = (typeof styleRuleCategories)[number];
export type StyleRulePriority = "hard" | "soft";

export type StyleSourceReference = {
  id: string;
  title: string;
  sourceType: StyleSourceType;
  role: StyleSourceRole;
  url?: string;
  path?: string;
};

export type StyleEvidence = {
  sourceId: string;
  excerpt: string;
  note?: string;
};

export type StyleRule = {
  id: string;
  category: StyleRuleCategory;
  priority: StyleRulePriority;
  instruction: string;
  evidence: StyleEvidence[];
};

export type StyleExample = {
  id: string;
  sourceId: string;
  title: string;
  excerpt: string;
  purpose: string;
  channel?: ContentChannel;
};

export type StyleProfileInput = {
  name: string;
  persona: string;
  readerRelationship: string;
  values: string[];
  tone: string[];
  rules: StyleRule[];
  preferredPhrases: string[];
  bannedPhrases: string[];
  channelOverrides: Partial<Record<ContentChannel, string[]>>;
  examples: StyleExample[];
  sources: StyleSourceReference[];
};

export type StyleProfileStatus = "draft" | "confirmed";

export type StyleProfile = StyleProfileInput & {
  id: "current-style-profile";
  accountId: "current-account";
  status: StyleProfileStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
};

export type StyleContractEvidence = StyleEvidence & {
  sourceTitle: string;
};

export type StyleContractRule = Omit<StyleRule, "id" | "evidence"> & {
  evidence: StyleContractEvidence[];
};

export type StyleContractExample = Omit<StyleExample, "id"> & {
  sourceTitle: string;
};

export type StyleContract = {
  profileId: StyleProfile["id"];
  profileVersion: number;
  profileName: string;
  mode: "default" | "temporary";
  persona: string;
  readerRelationship: string;
  values: string[];
  tone: string[];
  hardRules: StyleContractRule[];
  softRules: StyleContractRule[];
  preferredPhrases: string[];
  bannedPhrases: string[];
  channelOverrides: Partial<Record<ContentChannel, string[]>>;
  examples: StyleContractExample[];
  temporaryInstructions: string[];
  compiledAt: string;
};
