import { NextResponse } from "next/server";
import { getLatestAccountCapture } from "@/lib/store";
import { captureWithCurrentBusiness } from "@/modules/positioning/capture";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { analyzeAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const capture = await getLatestAccountCapture();
    if (!capture) {
      return NextResponse.json(
        { error: "还没有采集记录，请先在小红书账号主页完成采集" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({})) as { current?: unknown };
    const draft = await analyzeAccountContext(
      captureWithCurrentBusiness(capture, await getCurrentAccountContext(), body.current),
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
