import { analyzePositioning, type PositioningRequest } from "@/lib/ai";
import { getCurrentAccountContext } from "./repository";
import { createAccountContextDraft } from "./types";

export async function analyzeAccountContext(input: PositioningRequest) {
  const result = await analyzePositioning(input);
  return createAccountContextDraft(input, result);
}

export async function getActiveAccountContext() {
  const context = await getCurrentAccountContext();
  return context?.status === "confirmed" ? context : null;
}
