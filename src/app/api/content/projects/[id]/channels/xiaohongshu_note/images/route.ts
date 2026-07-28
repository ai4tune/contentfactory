import { NextResponse } from "next/server";
import {
  generateXiaohongshuVisualAssets,
  retryXiaohongshuVisualAsset,
} from "@/modules/content/image-service";
import {
  getContentProject,
  saveChannelVisualAssets,
} from "@/modules/content/server/project-repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { assetId?: unknown };
    const project = await getContentProject(id);
    if (!project) {
      return NextResponse.json({ error: "内容项目不存在。" }, { status: 404 });
    }

    const draft = project.channelDrafts.find(
      (item) => item.channel === "xiaohongshu_note" && item.status === "generated",
    );
    if (!draft) {
      return NextResponse.json({ error: "请先生成并保存小红书文案。" }, { status: 400 });
    }

    let visualAssets;
    if (typeof body.assetId === "string" && body.assetId) {
      const current = draft.visualAssets?.find((item) => item.id === body.assetId);
      if (!current) {
        return NextResponse.json({ error: "要重新生成的图片不存在。" }, { status: 404 });
      }
      const retried = await retryXiaohongshuVisualAsset(current);
      visualAssets = (draft.visualAssets ?? []).map((item) =>
        item.id === current.id ? retried : item,
      );
    } else {
      visualAssets = await generateXiaohongshuVisualAssets({
        topic: project.topic,
        content: draft.content,
        accountContext: project.accountSnapshot,
      });
    }

    const updatedProject = await saveChannelVisualAssets(
      project.id,
      "xiaohongshu_note",
      visualAssets,
    );
    if (!updatedProject) {
      return NextResponse.json({ error: "内容项目不存在。" }, { status: 404 });
    }
    return NextResponse.json({ project: updatedProject, assets: visualAssets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "小红书配图生成失败。" },
      { status: 500 },
    );
  }
}
