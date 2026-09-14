import { NextResponse } from "next/server";
import { getContentPlan, updateContentPlan } from "@/modules/plans/repository";
import { parsePlanPatch, PlanValidationError } from "@/modules/plans/request";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const plan = await getContentPlan(id);
  return plan
    ? NextResponse.json({ plan })
    : NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const current = await getContentPlan(id);
    if (!current) return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
    const update = parsePlanPatch(await request.json().catch(() => ({})), current);
    const plan = await updateContentPlan(id, update);
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容计划更新失败。" },
      { status: error instanceof PlanValidationError ? 400 : 500 },
    );
  }
}
