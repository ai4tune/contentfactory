import { NextResponse } from "next/server";
import { normalizeStyleProfileInput, validateStyleProfileForConfirmation } from "@/modules/style-profile/request";
import { getCurrentStyleProfile, saveCurrentStyleProfile } from "@/modules/style-profile/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ profile: await getCurrentStyleProfile() });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { action?: unknown; profile?: unknown };
    if (body.action !== "save" && body.action !== "confirm") {
      return NextResponse.json({ error: "Action must be save or confirm" }, { status: 400 });
    }

    const profile = normalizeStyleProfileInput(body.profile);
    if (!profile) {
      return NextResponse.json(
        { error: "Name, persona, and reader relationship are required" },
        { status: 400 },
      );
    }

    if (body.action === "confirm") {
      const issues = validateStyleProfileForConfirmation(profile);
      if (issues.length) {
        return NextResponse.json({ error: "风格档案还不能确认。", issues }, { status: 422 });
      }
    }

    return NextResponse.json({
      profile: await saveCurrentStyleProfile(profile, body.action === "confirm" ? "confirmed" : "draft"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Style profile update failed" },
      { status: 500 },
    );
  }
}
