import { InterviewWorkspace } from "@/modules/onboarding/components/interview-workspace";
import { getInterviewInitialState } from "@/modules/onboarding/interview-service";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  return <InterviewWorkspace initialState={await getInterviewInitialState()} />;
}
