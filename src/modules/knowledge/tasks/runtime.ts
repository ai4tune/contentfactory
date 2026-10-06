import { getRun, start } from "workflow/api";
import { getDataWorkspaceId } from "@/lib/data-workspace";
import { runKnowledgeTask } from "./workflow";
import { listKnowledgeTasks, updateKnowledgeTask } from "./repository";
import { isKnowledgeTaskActive, type StoredKnowledgeTask } from "./types";

export async function launchKnowledgeTask(task: StoredKnowledgeTask) {
  let runId: string;
  try {
    const workspaceId = await getDataWorkspaceId();
    const run = await start(runKnowledgeTask, [task.id, task.attempt, workspaceId]);
    runId = run.runId;
  } catch {
    await updateKnowledgeTask(task.id, task.attempt, (current) => current.runId ? current : ({
      ...current, status: "failed", stage: "后台任务提交失败",
      error: "后台暂时无法接收任务，请点击继续重试。", finishedAt: new Date().toISOString(),
    }));
    throw new Error("后台任务提交失败，请稍后重试。");
  }
  // The workflow is already accepted. Its first step also records runId;
  // a transient metadata write failure must not turn an accepted run into a failed task.
  await updateKnowledgeTask(task.id, task.attempt, (current) => ({ ...current, runId })).catch(() => undefined);
}

export async function reconcileKnowledgeTasks() {
  const tasks = await listKnowledgeTasks();
  await Promise.all(tasks.filter(isKnowledgeTaskActive).map(async (task) => {
    let failed = false;
    if (!task.runId) {
      failed = Date.now() - Date.parse(task.updatedAt) > 120_000;
    } else {
      try {
        const run = getRun(task.runId);
        if (!(await run.exists)) failed = true;
        else {
          const status = await run.status;
          failed = status === "failed" || status === "cancelled" || status === "completed";
        }
      } catch {
        // A temporary runtime lookup error is not evidence that processing stopped.
        return;
      }
    }
    if (failed) await updateKnowledgeTask(task.id, task.attempt, (current) =>
      !isKnowledgeTaskActive(current) ? current : ({
        ...current, status: "failed", stage: "后台任务中断，已保存进度",
        error: "后台任务未完成，可以继续重试。已完成的批次仍保留。", finishedAt: new Date().toISOString(),
      }));
  }));
  return listKnowledgeTasks();
}
