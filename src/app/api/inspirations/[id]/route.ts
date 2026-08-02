import { NextResponse } from "next/server";
import { getInspirationRecord, toInspirationReference } from "@/modules/inspirations/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const record = await getInspirationRecord(id);
    if (!record) return NextResponse.json({ error: "爆款不存在" }, { status: 404 });
    return NextResponse.json({ inspiration: record, reference: toInspirationReference(record) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "爆款详情读取失败" },
      { status: 500 },
    );
  }
}
