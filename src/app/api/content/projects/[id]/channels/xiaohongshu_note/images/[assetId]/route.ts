import { NextResponse } from "next/server";
import { isAllowedGeneratedImageUrl } from "@/modules/content/image-service";
import { getContentProject } from "@/modules/content/server/project-repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; assetId: string }> },
) {
  try {
    const { id, assetId } = await context.params;
    const project = await getContentProject(id);
    const draft = project?.channelDrafts.find((item) => item.channel === "xiaohongshu_note");
    const asset = draft?.visualAssets?.find((item) => item.id === assetId);
    if (!asset?.imageUrl || asset.status !== "generated") {
      return NextResponse.json({ error: "图片不存在。" }, { status: 404 });
    }
    if (!isAllowedGeneratedImageUrl(asset.imageUrl)) {
      return NextResponse.json({ error: "图片地址不在允许范围内。" }, { status: 400 });
    }

    const response = await fetch(asset.imageUrl, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "图片下载失败。" }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/png",
        "Content-Disposition": `attachment; filename="xiaohongshu-${asset.kind}-${asset.id}.png"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片下载失败。" },
      { status: 500 },
    );
  }
}
