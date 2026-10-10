import { getFirstContentAccount, getFirstContentSnapshot } from "@/modules/onboarding/first-content/service";
import { FirstContentWorkspace } from "@/modules/onboarding/first-content/workspace";
import { StartFirstContentWorkspace } from "@/modules/onboarding/first-content/start-workspace";
import { getInterviewInitialState } from "@/modules/onboarding/interview-service";

export const dynamic = "force-dynamic";

export default async function FirstContentPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  if (!await getFirstContentAccount()) return <StartFirstContentWorkspace initialState={await getInterviewInitialState()} />;
  const values = await searchParams;
  return <FirstContentWorkspace initialData={await getFirstContentSnapshot()} initialTopic={values.topic?.slice(0, 200)} />;
}
