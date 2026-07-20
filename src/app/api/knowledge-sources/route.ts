import { NextResponse } from "next/server";
import { listRemoteKnowledgeSources } from "@/modules/knowledge/server/source-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ sources: await listRemoteKnowledgeSources() });
}
