import { PositioningClient } from "./positioning-client";
import { getCurrentAccountContext } from "@/modules/positioning/repository";

export const dynamic = "force-dynamic";

export default async function PositioningPage() {
  const context = await getCurrentAccountContext();

  return <PositioningClient initialContext={context} />;
}
