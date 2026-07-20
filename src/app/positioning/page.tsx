import { PositioningClient } from "./positioning-client";
import { getCurrentAccountProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PositioningPage() {
  const profile = await getCurrentAccountProfile();

  return <PositioningClient initialProfile={profile} />;
}

