import { NextResponse } from "next/server";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { getConfirmedStyleProfile } from "@/modules/style-profile/repository";
import { getContentPlan } from "@/modules/plans/repository";
import { parseEvidenceList, PlanValidationError } from "@/modules/plans/request";
import { regenerateUnlockedPlanItems } from "@/modules/plans/service";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const [plan, account, styleProfile] = await Promise.all([
      getContentPlan(id),
      getActiveAccountContext(),
      getConfirmedStyleProfile(),
    ]);
    if (!plan) return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
    if (plan.status === "archived") {
      return NextResponse.json({ error: "已归档计划不能重新生成。" }, { status: 409 });
    }
    if (!account) return NextResponse.json({ error: "请先确认当前账号定位。" }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { contextEvidence?: unknown };
    const updated = await regenerateUnlockedPlanItems({
      plan,
      account,
      styleProfileVersion: styleProfile?.version,
      contextEvidence: parseEvidenceList(body.contextEvidence, 50),
    });
    return NextResponse.json({ plan: updated });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json(
        { error: "30 天内容计划重新生成超时，原计划未改变。请稍后重试。" },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容计划重新生成失败。" },
      { status: error instanceof PlanValidationError ? 400 : 502 },
    );
  }
}
