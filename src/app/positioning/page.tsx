import { PositioningClient } from "./positioning-client";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getLatestAccountCapture } from "@/lib/store";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";

export const dynamic = "force-dynamic";

export default async function PositioningPage() {
  const [context, capture, knowledgeProfile] = await Promise.all([
    getCurrentAccountContext(),
    getLatestAccountCapture(),
    getConfirmedKnowledgeProfile(),
  ]);

  const stateKey = `${context?.updatedAt ?? "no-context"}:${capture?.capturedAt ?? "no-capture"}:${knowledgeProfile?.updatedAt ?? "no-knowledge"}`;

  return <PositioningClient key={stateKey} initialContext={context} initialCapture={capture} initialKnowledgeProfile={knowledgeProfile} />;
}
