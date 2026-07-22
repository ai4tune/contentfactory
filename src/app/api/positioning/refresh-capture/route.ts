import { NextResponse } from "next/server";
import { getLatestAccountCapture } from "@/lib/store";
import { captureToPositioningRequest } from "@/modules/positioning/capture";
import { analyzeAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const capture = await getLatestAccountCapture();
    if (!capture) {
      return NextResponse.json(
        { error: "还没有采集记录，请先在小红书账号主页完成采集" },
        { status: 404 },
      );
    }

    const draft = await analyzeAccountContext(
      captureToPositioningRequest(capture),
      "capture",
    );
    return NextResponse.json({ capture, draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新分析采集结果失败" },
      { status: 500 },
    );
  }
}
