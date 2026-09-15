import { NextResponse } from "next/server";
import { parseOnboardingUpdate, OnboardingValidationError } from "@/modules/onboarding/request";
import {
  getOnboardingSnapshot,
  OnboardingCompletionError,
  updateOnboardingStatus,
} from "@/modules/onboarding/service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: (await getOnboardingSnapshot()).status });
}

export async function PATCH(request: Request) {
  try {
    const update = parseOnboardingUpdate(await request.json().catch(() => ({})));
    return NextResponse.json({ status: await updateOnboardingStatus(update) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "建档状态更新失败。",
        missingSteps: error instanceof OnboardingCompletionError ? error.missingSteps : undefined,
      },
      {
        status: error instanceof OnboardingValidationError
          ? 400
          : error instanceof OnboardingCompletionError ? 409 : 500,
      },
    );
  }
}
