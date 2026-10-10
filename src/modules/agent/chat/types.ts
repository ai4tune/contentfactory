import type { BriefKnowledgeSource } from "@/modules/content/types";
import type { ResearchSource, ResearchLocation } from "@/modules/research/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  turnId: string;
  sources?: BriefKnowledgeSource[];
};
export type Conversation = { id: string; title: string; createdAt: string; updatedAt: string; messages: ChatMessage[] };
export type ChatMemory = { id: string; content: string; updatedAt: string; sourceMessageId: string };
export type ToolRecord = {
  key: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "succeeded" | "failed";
  attempt?: number;
  output?: Record<string, unknown>;
  draftSources?: BriefKnowledgeSource[];
  researchSources?: ResearchSource[];
  error?: string;
  errorStatus?: number;
  externalAttempts?: number;
  updatedAt: string;
};
export type ChatTurn = {
  id: string;
  requestId: string;
  conversationId: string;
  messageId: string;
  attempt: number;
  status: "queued" | "running" | "waiting_user" | "completed" | "failed" | "paused";
  stage: string;
  createdAt: string;
  updatedAt: string;
  runId?: string;
  error?: string;
  tools: ToolRecord[];
  steps: number;
};
export type ChatStore = { conversations: Conversation[]; memories: ChatMemory[]; turns: ChatTurn[]; researchLocation?: ResearchLocation };
export class ChatError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function isActiveTurn(turn: ChatTurn) { return turn.status === "queued" || turn.status === "running"; }
