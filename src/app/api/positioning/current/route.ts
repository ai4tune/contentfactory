import { NextResponse } from "next/server";
import {
  confirmAccountContext,
  getCurrentAccountContext,
  skipAccountContext,
} from "@/modules/positioning/repository";
import type { AccountContextDraft } from "@/modules/positioning/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ context: await getCurrentAccountContext() });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as
      | { action: "skip" }
      | { action: "confirm"; draft?: AccountContextDraft };

    if (body.action === "skip") {
      return NextResponse.json({ context: await skipAccountContext() });
    }

    if (body.action !== "confirm" || !body.draft) {
      return NextResponse.json({ error: "A positioning draft is required" }, { status: 400 });
    }

    const draft = normalizeDraft(body.draft);
    if (!draft.business || !draft.offer || !draft.accountPosition) {
      return NextResponse.json(
        { error: "Business, offer, and account position are required" },
        { status: 400 },
      );
    }

    return NextResponse.json({ context: await confirmAccountContext(draft) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account context update failed" },
      { status: 500 },
    );
  }
}

function normalizeDraft(draft: AccountContextDraft): AccountContextDraft {
  return {
    source: draft.source === "capture" ? "capture" : "manual",
    input: draft.input,
    accountName: String(draft.accountName ?? "").trim(),
    business: String(draft.business ?? "").trim(),
    platforms: toStrings(draft.platforms),
    accountPosition: String(draft.accountPosition ?? "").trim(),
    targetAudience: toStrings(draft.targetAudience),
    offer: String(draft.offer ?? "").trim(),
    conversionGoal: String(draft.conversionGoal ?? "").trim(),
    contentPillars: toStrings(draft.contentPillars),
    brandVoice: toStrings(draft.brandVoice),
    preferredPhrases: toStrings(draft.preferredPhrases),
    bannedPhrases: toStrings(draft.bannedPhrases),
    contentDirections: toStrings(draft.contentDirections),
    recommendedTopics: toStrings(draft.recommendedTopics),
    analysisEvidence: toStrings(draft.analysisEvidence),
    informationGaps: toStrings(draft.informationGaps),
  };
}

function toStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
