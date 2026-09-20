import { NextResponse } from "next/server";
import { parseQuickCreationRequest, QuickRequestError } from "@/modules/content/quick/request";
import { generateQuickContent } from "@/modules/content/quick/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = parseQuickCreationRequest(await request.json().catch(() => ({})));
    return NextResponse.json(await generateQuickContent(input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "快速创作失败。" },
      { status: error instanceof QuickRequestError ? error.status : 500 },
    );
  }
}
