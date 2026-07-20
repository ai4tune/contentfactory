import { NextResponse } from "next/server";
import { readFeishuDocument } from "@/lib/feishu";
import { saveMaterial } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const document = await readFeishuDocument(id);
    await saveMaterial(document);

    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feishu document read failed" },
      { status: 500 },
    );
  }
}
