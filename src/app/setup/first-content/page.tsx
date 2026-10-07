import { redirect } from "next/navigation";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { getFirstContentSnapshot } from "@/modules/onboarding/first-content/service";
import { FirstContentWorkspace } from "@/modules/onboarding/first-content/workspace";

export const dynamic = "force-dynamic";

export default async function FirstContentPage() {
  if (!await getActiveAccountContext()) redirect("/setup/interview");
  return <FirstContentWorkspace initialData={await getFirstContentSnapshot()} />;
}
