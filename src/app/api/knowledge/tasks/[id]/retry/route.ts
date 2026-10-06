import { NextResponse } from "next/server";
import { getKnowledgeTask, retryKnowledgeTask } from "@/modules/knowledge/tasks/repository";
import { launchKnowledgeTask, reconcileKnowledgeTasks } from "@/modules/knowledge/tasks/runtime";
import { publicKnowledgeTask } from "@/modules/knowledge/tasks/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await reconcileKnowledgeTasks();
    const task = await retryKnowledgeTask(id);
    if (!task) return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
    await launchKnowledgeTask(task);
    return NextResponse.json({ task: publicKnowledgeTask((await getKnowledgeTask(id))!) }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
      ? error.message : "重试提交失败，请稍后刷新。" }, { status: 409 });
  }
}
