import { analyzePositioning, type PositioningRequest } from "@/lib/ai";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { formatKnowledgeProfileForPrompt } from "@/modules/knowledge-profile/service";
import { confirmAccountContext, getCurrentAccountContext } from "./repository";
import { createAccountContextDraft, type AccountContextDraft } from "./types";

export async function analyzeAccountContext(
  input: PositioningRequest,
  source: AccountContextDraft["source"] = "manual",
) {
  const profile = await getConfirmedKnowledgeProfile();
  const result = await analyzePositioning(input, formatKnowledgeProfileForPrompt(profile));
  return createAccountContextDraft(input, result, source);
}

export async function confirmCapturedAccountContext(draft: AccountContextDraft) {
  return confirmAccountContext({ ...draft, source: "capture" });
}

export async function getActiveAccountContext() {
  const context = await getCurrentAccountContext();
  return context?.status === "confirmed" ? context : null;
}
