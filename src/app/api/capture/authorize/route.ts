import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const token = process.env.CONTENT_FACTORY_CAPTURE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "采集服务尚未配置，请联系管理员。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
