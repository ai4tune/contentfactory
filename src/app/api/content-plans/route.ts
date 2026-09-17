import { NextResponse } from "next/server";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { getConfirmedStyleProfile } from "@/modules/style-profile/repository";
import { listContentPlans } from "@/modules/plans/repository";
import { parsePlanGenerationOptions, PlanValidationError } from "@/modules/plans/request";
import { generateNewContentPlan } from "@/modules/plans/service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ plans: await listContentPlans() });
}

export async function POST(request: Request) {
  try {
    const account = await getActiveAccountContext();
    if (!account) {
      return NextResponse.json({ error: "请先确认当前账号定位，再生成内容计划。" }, { status: 409 });
    }
    const body = await request.json().catch(() => ({}));
    const options = parsePlanGenerationOptions(body, account);
    const styleProfile = await getConfirmedStyleProfile();
    const plan = await generateNewContentPlan({
      account,
      styleProfileVersion: styleProfile?.version,
      options,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return planError(error, "内容计划生成失败。");
  }
}

function planError(error: unknown, fallback: string) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return NextResponse.json(
      { error: "30 天内容计划生成超时，计划尚未创建。请稍后重试；若持续超时，请检查 AI 模型服务。" },
      { status: 504 },
    );
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json(
    { error: message },
    { status: error instanceof PlanValidationError ? 400 : 502 },
  );
}
