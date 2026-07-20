import { NextResponse } from "next/server";
import { resolveFeishuUrl } from "@/lib/feishu";
import { saveMaterial } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "Feishu URL is required" }, { status: 400 });
    }

    const document = await resolveFeishuUrl(body.url);
    await saveMaterial(document);

    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feishu URL resolve failed" },
      { status: 500 },
    );
  }
}
