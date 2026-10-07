import { dataFilePath } from "@/lib/data-directory";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import { emptyInterviewAnswers, InterviewError, type InterviewState } from "./interview";

const storePath = dataFilePath("onboarding-interview.local.json");
const emptyState: InterviewState = { revision: 0, step: 0, answers: emptyInterviewAnswers, preview: null };

export function getInterviewState() {
  return readJsonFile<InterviewState>(storePath, emptyState);
}

export function updateInterviewState(revision: number, update: (current: InterviewState) => InterviewState | Promise<InterviewState>) {
  return updateJsonFile(storePath, emptyState, async (current) => {
    if (current.revision !== revision) throw new InterviewError("访谈已在其他页面更新，请刷新后继续。", 409);
    const next = await update(current);
    return { ...next, revision: current.revision + 1 };
  });
}
