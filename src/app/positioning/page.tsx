import path from "node:path";
import { PositioningClient } from "./positioning-client";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getLatestAccountCapture } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PositioningPage() {
  const [context, capture] = await Promise.all([
    getCurrentAccountContext(),
    getLatestAccountCapture(),
  ]);
  const extensionPath = path.join(process.cwd(), "extensions", "contentfactory-capture");

  const stateKey = `${context?.updatedAt ?? "no-context"}:${capture?.capturedAt ?? "no-capture"}`;

  return <PositioningClient key={stateKey} initialContext={context} initialCapture={capture} extensionPath={extensionPath} />;
}
