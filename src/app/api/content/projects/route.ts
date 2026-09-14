import { NextResponse } from "next/server";
import { saveContentProject } from "@/modules/content/server/project-repository";
import { normalizeContentBrief } from "@/modules/content/server/request";
import { getActiveAccountContext } from "@/modules/positioning/service";
import { getActiveStyleContract } from "@/modules/style-profile/service";
import { normalizeTemporaryStyleInstructions } from "@/modules/style-profile/request";
import { getIdeaContext } from "@/modules/ideas/service";
import { getContentPlan, linkContentProjectToPlanItem } from "@/modules/plans/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: unknown;
      brief?: unknown;
      ideaId?: unknown;
      contentPlanId?: unknown;
      contentPlanItemId?: unknown;
      temporaryStyleInstructions?: unknown;
    };
    const topic = String(body.topic ?? "").trim();
    const brief = normalizeContentBrief(body.brief);
    if (!topic || !brief) {
      return NextResponse.json({ error: "简报内容不完整，请检查目标受众、内容目标、核心观点、内容结构和知识引用。" }, { status: 400 });
    }
    const ideaId = String(body.ideaId ?? "").trim();
    if (ideaId) {
      const ideaContext = await getIdeaContext(ideaId);
      if (!ideaContext) return NextResponse.json({ error: "选题不存在。" }, { status: 404 });
      brief.ideaContext = ideaContext;
    }
    const contentPlanId = String(body.contentPlanId ?? "").trim();
    const contentPlanItemId = String(body.contentPlanItemId ?? "").trim();
    if (Boolean(contentPlanId) !== Boolean(contentPlanItemId)) {
      return NextResponse.json({ error: "内容计划和计划选题必须同时提供。" }, { status: 400 });
    }
    if (contentPlanId) {
      const plan = await getContentPlan(contentPlanId);
      if (!plan) return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
      if (plan.status === "archived") {
        return NextResponse.json({ error: "已归档计划不能创建内容项目。" }, { status: 409 });
      }
      if (!plan.items.some((item) => item.id === contentPlanItemId)) {
        return NextResponse.json({ error: "计划选题不存在。" }, { status: 404 });
      }
    }

    const [accountSnapshot, styleSnapshot] = await Promise.all([
      getActiveAccountContext(),
      getActiveStyleContract({
        temporaryInstructions: normalizeTemporaryStyleInstructions(body.temporaryStyleInstructions),
      }),
    ]);
    const project = await saveContentProject({
      topic,
      brief,
      contentPlanId: contentPlanId || undefined,
      contentPlanItemId: contentPlanItemId || undefined,
      accountSnapshot,
      styleSnapshot,
    });
    if (contentPlanId && contentPlanItemId) {
      await linkContentProjectToPlanItem(contentPlanId, contentPlanItemId, project.id);
    }
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容项目保存失败" },
      { status: 500 },
    );
  }
}
