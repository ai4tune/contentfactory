import { NextResponse } from "next/server";
import { getContentPlan, updateContentPlanItem } from "@/modules/plans/repository";
import { parsePlanItemPatch, PlanValidationError } from "@/modules/plans/request";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await context.params;
    const current = await getContentPlan(id);
    if (!current) return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
    if (!current.items.some((item) => item.id === itemId)) {
      return NextResponse.json({ error: "计划选题不存在。" }, { status: 404 });
    }
    const update = parsePlanItemPatch(await request.json().catch(() => ({})), current);
    const plan = await updateContentPlanItem(id, itemId, update, { humanEdit: true });
    return NextResponse.json({ plan, item: plan?.items.find((item) => item.id === itemId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "计划选题更新失败。" },
      { status: error instanceof PlanValidationError ? 400 : 500 },
    );
  }
}
