import { NextResponse } from "next/server";
import { addPlanTask, getContentPlan } from "@/modules/plans/repository";
import { parseManualTask, PlanValidationError } from "@/modules/plans/request";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const current = await getContentPlan(id);
    if (!current) return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
    if (current.status === "archived") return NextResponse.json({ error: "已归档计划不能新增任务。" }, { status: 409 });
    const input = parseManualTask(await request.json(), current);
    return NextResponse.json({ plan: await addPlanTask(id, input) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "添加任务失败。" }, { status: error instanceof PlanValidationError ? 400 : 500 });
  }
}
