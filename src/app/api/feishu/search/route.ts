import { NextResponse } from "next/server";
import { searchFeishuDocuments } from "@/lib/feishu";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const items = await searchFeishuDocuments(body.query ?? "");

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feishu search failed" },
      { status: 500 },
    );
  }
}
