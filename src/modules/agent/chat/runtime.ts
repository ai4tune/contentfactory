import { getRun, start } from "workflow/api";
import { getDataWorkspaceId } from "@/lib/data-workspace";
import { ChatError, isActiveTurn, type ChatTurn } from "./types";
import { requireTurn, resumeTurn, updateTurn } from "./repository";
import { runChatTurn } from "./workflow";

export async function launchChatTurn(turn: ChatTurn) {
  let runId: string;
  try {
    const run = await start(runChatTurn, [turn.id, turn.attempt, await getDataWorkspaceId()]);
    runId = run.runId;
  } catch {
    await updateTurn(turn.id, turn.attempt, (item) => !isActiveTurn(item) ? item : ({ ...item, status: "failed", stage: "任务提交未完成，诉求已保存", error: "后台暂时无法接收任务，请点击继续重试。" }));
    throw new ChatError("后台提交未完成，诉求已保存，请刷新后重试。", 503);
  }
  await updateTurn(turn.id, turn.attempt, (item) => ({ ...item, runId })).catch(() => undefined);
}
export async function isTurnInterrupted(turn: ChatTurn) {
  if (!isActiveTurn(turn)) return false;
  if (!turn.runId) return Date.now() - Date.parse(turn.updatedAt) > 120_000;
  const run = getRun(turn.runId);
  if (!await run.exists) return true;
  return ["failed", "cancelled", "completed"].includes(await run.status);
}
export async function continueChatTurn(id: string) {
  const current = await requireTurn(id);
  if (isActiveTurn(current) && !await isTurnInterrupted(current)) throw new ChatError("任务仍在后台执行，请等待完成或先暂停。", 409);
  const next = await resumeTurn(id);
  if (!next) throw new ChatError("任务已在其他页面更新，请刷新。", 409);
  await launchChatTurn(next);
  return next;
}
export async function pauseChatTurn(id: string) {
  const current = await requireTurn(id);
  const next = await updateTurn(id, current.attempt, (item) => !isActiveTurn(item) ? item : ({ ...item, status: "paused", stage: "已暂停，已完成结果保留" }));
  if (current.runId && isActiveTurn(current)) await getRun(current.runId).cancel().catch(() => undefined);
  return next;
}
