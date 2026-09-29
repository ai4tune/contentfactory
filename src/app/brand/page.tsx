import { BrandClient } from "./brand-client";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getLatestAccountCapture } from "@/lib/store";
import {
  getConfirmedStyleProfile,
  getCurrentStyleProfile,
} from "@/modules/style-profile/repository";
import { getConfirmedKnowledgeProfile } from "@/modules/knowledge-profile/repository";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const [context, capture, profile, confirmedProfile, knowledgeProfile] = await Promise.all([
    getCurrentAccountContext(),
    getLatestAccountCapture(),
    getCurrentStyleProfile(),
    getConfirmedStyleProfile(),
    getConfirmedKnowledgeProfile(),
  ]);

  const stateKey = `${context?.updatedAt ?? "no-context"}:${capture?.capturedAt ?? "no-capture"}:${profile?.updatedAt ?? "no-profile"}:${knowledgeProfile?.updatedAt ?? "no-knowledge"}`;

  return (
    <BrandClient
      key={stateKey}
      initialContext={context}
      initialCapture={capture}
      initialProfile={profile}
      initialConfirmedProfile={confirmedProfile}
      initialKnowledgeProfile={knowledgeProfile}
    />
  );
}
