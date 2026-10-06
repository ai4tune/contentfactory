import { beginKnowledgeTask, processKnowledgeBatch, compileKnowledgeResult, saveKnowledgeResult, failKnowledgeTask } from "./steps";

export async function runKnowledgeTask(id: string, attempt: number, workspaceId: string | null) {
  "use workflow";
  try {
    const count = await beginKnowledgeTask(id, attempt, workspaceId);
    for (let index = 0; index < count; index += 2) {
      const work = [processKnowledgeBatch(id, attempt, index, workspaceId)];
      if (index + 1 < count) work.push(processKnowledgeBatch(id, attempt, index + 1, workspaceId));
      // Let both batches settle before marking the task failed, so completed work is retained.
      const results = await Promise.allSettled(work);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }
    await compileKnowledgeResult(id, attempt, workspaceId);
    await saveKnowledgeResult(id, attempt, workspaceId);
  } catch (error) {
    await failKnowledgeTask(id, attempt, error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
      ? error.message : "后台任务未完成，已保存进度。请重试继续处理。", workspaceId);
    throw error;
  }
}
