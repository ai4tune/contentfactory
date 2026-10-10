import { ChatWorkspace } from "./chat-workspace";

export function AgentCommandBar({ primaryHref }: { hasConfirmedPlan: boolean; primaryHref: string }) {
  return <ChatWorkspace primaryHref={primaryHref} />;
}
