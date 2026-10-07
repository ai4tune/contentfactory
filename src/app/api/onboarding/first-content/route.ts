import { NextResponse } from "next/server";
import { asRecord, InterviewError } from "@/modules/onboarding/interview";
import { isIndustry } from "@/modules/onboarding/first-content/catalog";
import { confirmStarterStyle, generateFirstContent, getFirstContentSnapshot, previewStarterStyle } from "@/modules/onboarding/first-content/service";
import { StyleVersionError } from "@/modules/style-profile/repository";
import { ContentFactError } from "@/modules/content/fact-check";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const industry = new URL(request.url).searchParams.get("industry");
    if (industry && !isIndustry(industry)) throw new InterviewError("请选择支持的行业。");
    return NextResponse.json(await getFirstContentSnapshot(industry && isIndustry(industry) ? industry : undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json().catch(() => ({})));
    if (!Number.isInteger(body.version) || Number(body.version) < 0) throw new InterviewError("风格版本无效，请刷新后继续。");
    const version = Number(body.version);
    if (body.action === "preview_style") return NextResponse.json({ profile: await previewStarterStyle({ industry: body.industry, voice: body.voice, adjustments: body.adjustments ?? "", version }) });
    if (body.action === "confirm_style") return NextResponse.json({ profile: await confirmStarterStyle(version) });
    if (body.action === "generate") return NextResponse.json(await generateFirstContent(body.topicId, version));
    throw new InterviewError("请选择预览口吻、确认口吻或创作。");
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "操作未完成，请重试。" }, { status: error instanceof InterviewError || error instanceof StyleVersionError || error instanceof ContentFactError ? error.status : 500 });
}
