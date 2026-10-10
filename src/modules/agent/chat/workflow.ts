import { executeChatTurn } from "./steps";

export async function runChatTurn(id: string, attempt: number, workspaceId: string | null) {
  "use workflow";
  await executeChatTurn(id, attempt, workspaceId);
}
