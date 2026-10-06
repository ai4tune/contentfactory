import { withDataWorkspace } from "@/lib/data-workspace";
import { FatalError, RetryableError, getStepMetadata, getWorkflowMetadata } from "workflow";
import { compileKnowledgeBatch, mergeKnowledgeBatches, splitKnowledgeBatches } from "@/modules/knowledge-profile/service";
import { saveKnowledgeProfile } from "@/modules/knowledge-profile/repository";
import { planKnowledgeOrganization } from "../server/organization-service";
import { knowledgeOrganizationFolders, type KnowledgeOrganizationPlan } from "../organization";
import { getKnowledgeTask, updateKnowledgeTask } from "./repository";
import { canRetryKnowledgeError, knowledgeTaskError } from "./errors";
import type { StoredKnowledgeTask } from "./types";

export async function beginKnowledgeTask(id: string, attempt: number, workspaceId: string | null) {
  "use step";
  return withDataWorkspace(workspaceId, () => beginKnowledgeTaskInWorkspace(id, attempt));
}

async function beginKnowledgeTaskInWorkspace(id: string, attempt: number) {
  const task = await requireTask(id, attempt);
  await updateKnowledgeTask(id, attempt, (current) => ({
    ...current, status: "running", runId: getWorkflowMetadata().workflowRunId,
    stage: `正在读取 ${current.sourceCount} 份资料，分 ${current.totalBatches} 批处理`,
  }));
  return task.totalBatches;
}

export async function processKnowledgeBatch(id: string, attempt: number, index: number, workspaceId: string | null) {
  "use step";
  return withDataWorkspace(workspaceId, () => processKnowledgeBatchInWorkspace(id, attempt, index));
}

async function processKnowledgeBatchInWorkspace(id: string, attempt: number, index: number) {
  const task = await requireTask(id, attempt);
  if (task.batches[String(index)]) return;
  await updateKnowledgeTask(id, attempt, (current) => ({
    ...current, status: "running", stage: `正在分析资料，已保存 ${current.completedBatches}/${current.totalBatches} 批`,
  }));
  try {
    const batch = splitKnowledgeBatches(task.sources!)[index];
    const result = task.kind === "profile"
      ? await compileKnowledgeBatch(batch)
      : await planKnowledgeOrganization(batch);
    await updateKnowledgeTask(id, attempt, (current) => {
      const batches = { ...current.batches, [String(index)]: result };
      const completedBatches = Object.keys(batches).length;
      return { ...current, batches, completedBatches, stage: `已保存 ${completedBatches}/${current.totalBatches} 批分析成果` };
    });
  } catch (error) { await retryOrFail(id, attempt, error); }
}
processKnowledgeBatch.maxRetries = 2;

export async function compileKnowledgeResult(id: string, attempt: number, workspaceId: string | null) {
  "use step";
  return withDataWorkspace(workspaceId, () => compileKnowledgeResultInWorkspace(id, attempt));
}

async function compileKnowledgeResultInWorkspace(id: string, attempt: number) {
  const task = await requireTask(id, attempt);
  if (task.kind === "organization" || task.compiledProfile) return;
  await updateKnowledgeTask(id, attempt, (current) => ({ ...current, status: "running", stage: "批次分析已完成，正在合并档案并核对来源" }));
  try {
    const partials = Array.from({ length: task.totalBatches }, (_, index) => task.batches[String(index)]);
    const compiledProfile = await mergeKnowledgeBatches(partials, task.sources!);
    await updateKnowledgeTask(id, attempt, (current) => ({ ...current, compiledProfile }));
  } catch (error) { await retryOrFail(id, attempt, error); }
}
compileKnowledgeResult.maxRetries = 2;

export async function saveKnowledgeResult(id: string, attempt: number, workspaceId: string | null) {
  "use step";
  return withDataWorkspace(workspaceId, () => saveKnowledgeResultInWorkspace(id, attempt));
}

async function saveKnowledgeResultInWorkspace(id: string, attempt: number) {
  const task = await getKnowledgeTask(id);
  if (task?.status === "succeeded" && task.attempt === attempt) return;
  const current = await requireTask(id, attempt);
  let profileId: string | undefined;
  let plan: KnowledgeOrganizationPlan | undefined;
  if (current.kind === "profile") {
    if (!current.compiledProfile) throw new FatalError("档案合并结果缺失，请重试。");
    const profile = await saveKnowledgeProfile(current.compiledProfile, "draft", `knowledgeProfile_${id}`);
    profileId = profile.id;
  } else {
    const plans = Array.from({ length: current.totalBatches }, (_, index) => current.batches[String(index)] as KnowledgeOrganizationPlan);
    plan = { summary: `已为 ${current.sourceCount} 份资料生成整理建议，请核对后确认创建副本。`, folders: [...knowledgeOrganizationFolders], assignments: plans.flatMap((item) => item.assignments) };
  }
  await updateKnowledgeTask(id, attempt, (item) => ({
    ...item, status: "succeeded", profileId, plan,
    stage: current.kind === "profile" ? "档案草稿已保存，请核对事实和来源后确认。" : "目录整理建议已保存，请核对归类后确认。",
    finishedAt: new Date().toISOString(), error: undefined, sources: undefined, batches: {}, compiledProfile: undefined,
  }));
}

export async function failKnowledgeTask(id: string, attempt: number, message: string, workspaceId: string | null) {
  "use step";
  return withDataWorkspace(workspaceId, () => failKnowledgeTaskInWorkspace(id, attempt, message));
}

async function failKnowledgeTaskInWorkspace(id: string, attempt: number, message: string) {
  await updateKnowledgeTask(id, attempt, (task) => task.status === "succeeded" ? task : ({
    ...task, status: "failed", stage: "任务未完成，已保存进度", error: message, finishedAt: new Date().toISOString(),
  }));
}

async function requireTask(id: string, attempt: number): Promise<StoredKnowledgeTask> {
  const task = await getKnowledgeTask(id);
  if (!task || task.attempt !== attempt || !task.sources || task.status === "failed") {
    throw new FatalError("该任务已失效，请查看最新任务状态。");
  }
  return task;
}

async function retryOrFail(id: string, attempt: number, error: unknown): Promise<never> {
  const message = knowledgeTaskError(error);
  const retry = canRetryKnowledgeError(error) && getStepMetadata().attempt < 3;
  if (!retry) throw new FatalError(message);
  await updateKnowledgeTask(id, attempt, (task) => ({
    ...task, status: "retrying", stage: "本批处理遇到超时或服务异常，10 秒后自动重试；已完成批次保留",
  }));
  throw new RetryableError(message, { retryAfter: "10s" });
}
