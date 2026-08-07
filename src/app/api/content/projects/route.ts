import { NextResponse } from "next/server";
import { saveContentProject } from "@/modules/content/server/project-repository";
import { normalizeContentBrief } from "@/modules/content/server/request";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { getActiveStyleContract } from "@/modules/style-profile/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { topic?: unknown; brief?: unknown };
    const topic = String(body.topic ?? "").trim();
    const brief = normalizeContentBrief(body.brief);
    if (!topic || !brief) {
      return NextResponse.json({ error: "请先完成并确认内容简报。" }, { status: 400 });
    }

    const [accountSnapshot, styleSnapshot] = await Promise.all([
      getActiveAccountContext(),
      getActiveStyleContract(),
    ]);
    const project = await saveContentProject({
      topic,
      brief,
      accountSnapshot,
      styleSnapshot,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容项目保存失败" },
      { status: 500 },
    );
  }
}
