import { NextResponse } from "next/server";
import { asRecord, InterviewError, parseInterviewAnswers, parseInterviewRevision } from "@/modules/onboarding/interview";
import { confirmBusiness, confirmInterview, getInterviewInitialState, previewInterview, saveInterviewAnswers } from "@/modules/onboarding/interview-service";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET() {
  return NextResponse.json({ interview: await getInterviewInitialState() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let previewRequested = false;
  try {
    const body = asRecord(await request.json().catch(() => ({})));
    const revision = parseInterviewRevision(body.revision);
    let interview;
    if (body.action === "save") {
      const step = Number(body.step);
      if (!Number.isInteger(step) || step < 0 || step > 5) throw new InterviewError("访谈步骤无效。");
      interview = await saveInterviewAnswers(parseInterviewAnswers(body.answers), revision, step);
    } else if (body.action === "confirm_business") {
      interview = await confirmBusiness(parseInterviewAnswers(body.answers, true), revision);
    } else if (body.action === "preview") {
      const answers = parseInterviewAnswers(body.answers, true);
      previewRequested = true;
      interview = await previewInterview(answers, revision);
    } else if (body.action === "confirm") {
      interview = await confirmInterview(revision, body.previewId, body.edits);
    } else {
      throw new InterviewError("访谈操作无效。");
    }
    return NextResponse.json({ interview });
  } catch (error) {
    const interview = previewRequested && !(error instanceof InterviewError)
      ? await getInterviewInitialState().catch(() => undefined)
      : undefined;
    return NextResponse.json({ error: error instanceof Error ? error.message : "访谈处理失败，已保存的回答会保留。", ...(interview ? { interview } : {}) }, { status: error instanceof InterviewError ? error.status : 500 });
  }
}
