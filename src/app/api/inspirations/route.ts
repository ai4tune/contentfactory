import { NextResponse } from "next/server";
import { listInspirationReferences } from "@/modules/inspirations/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ inspirations: await listInspirationReferences() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "爆款库读取失败。" },
      { status: 500 },
    );
  }
}
