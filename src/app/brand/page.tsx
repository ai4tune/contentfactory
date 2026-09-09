import path from "node:path";
import { BrandClient } from "./brand-client";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getLatestAccountCapture } from "@/lib/store";
import {
  getConfirmedStyleProfile,
  getCurrentStyleProfile,
} from "@/modules/style-profile/repository";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const [context, capture, profile, confirmedProfile] = await Promise.all([
    getCurrentAccountContext(),
    getLatestAccountCapture(),
    getCurrentStyleProfile(),
    getConfirmedStyleProfile(),
  ]);
  const extensionPath = path.join(process.cwd(), "extensions", "contentfactory-capture");

  const stateKey = `${context?.updatedAt ?? "no-context"}:${capture?.capturedAt ?? "no-capture"}:${profile?.updatedAt ?? "no-profile"}`;

  return (
    <BrandClient
      key={stateKey}
      initialContext={context}
      initialCapture={capture}
      initialProfile={profile}
      initialConfirmedProfile={confirmedProfile}
      extensionPath={extensionPath}
    />
  );
}
