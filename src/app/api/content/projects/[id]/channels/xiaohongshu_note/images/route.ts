import { NextResponse } from "next/server";
import {
  generateXiaohongshuVisualAssets,
  retryXiaohongshuVisualAsset,
} from "@/modules/content/image-service";
import {
  getContentProject,
  saveChannelVisualAssets,
} from "@/modules/content/server/project-repository";
import type { GeneratedVisualAsset } from "@/modules/content/types";

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
      if (current.kind !== "cover") {
        return NextResponse.json(
          { error: "正文内页由文字模板生成，可直接编辑，不需要调用生图服务。" },
          { status: 400 },
        );
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      assetId?: unknown;
      title?: unknown;
      body?: unknown;
      points?: unknown;
    };
    const project = await getContentProject(id);
    if (!project) {
      return NextResponse.json({ error: "内容项目不存在。" }, { status: 404 });
    }
    const draft = project.channelDrafts.find((item) => item.channel === "xiaohongshu_note");
    const assetId = String(body.assetId ?? "").trim();
    const current = draft?.visualAssets?.find((item) => item.id === assetId);
    if (!current) {
      return NextResponse.json({ error: "要编辑的图文页不存在。" }, { status: 404 });
    }

    const title = String(body.title ?? "").trim().slice(0, current.kind === "cover" ? 28 : 32);
    const assetBody = String(body.body ?? "").trim().slice(0, current.kind === "cover" ? 60 : 180);
    const points = normalizeAssetPoints(body.points);
    if (!title) {
      return NextResponse.json({ error: "图文页标题不能为空。" }, { status: 400 });
    }

    const updatedAsset: GeneratedVisualAsset = {
      ...current,
      title,
      body: assetBody,
      points: current.kind === "card" ? points : undefined,
      updatedAt: new Date().toISOString(),
    };
    const visualAssets = (draft?.visualAssets ?? []).map((item) =>
      item.id === current.id ? updatedAsset : item,
    );
    const updatedProject = await saveChannelVisualAssets(
      project.id,
      "xiaohongshu_note",
      visualAssets,
    );
    return NextResponse.json({ project: updatedProject, asset: updatedAsset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图文页保存失败。" },
      { status: 500 },
    );
  }
}

function normalizeAssetPoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().slice(0, 64))
    .filter(Boolean)
    .slice(0, 5);
}
