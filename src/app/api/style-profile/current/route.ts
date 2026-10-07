import { NextResponse } from "next/server";
import { normalizeStyleProfileInput, validateStyleProfileForConfirmation } from "@/modules/style-profile/request";
import { getCurrentStyleProfile, saveCurrentStyleProfile, StyleVersionError } from "@/modules/style-profile/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ profile: await getCurrentStyleProfile() });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { action?: unknown; profile?: unknown; version?: unknown };
    if (body.version !== undefined && (!Number.isInteger(body.version) || Number(body.version) < 0)) {
      return NextResponse.json({ error: "风格版本无效，请刷新后继续。" }, { status: 400 });
    }
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
      profile: await saveCurrentStyleProfile(profile, body.action === "confirm" ? "confirmed" : "draft", body.version === undefined ? undefined : Number(body.version)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Style profile update failed" },
      { status: error instanceof StyleVersionError ? 409 : 500 },
    );
  }
}
