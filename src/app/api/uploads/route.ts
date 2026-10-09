import { NextResponse } from "next/server";
import type { KnowledgeSource } from "@/lib/feishu";
import { saveMaterial } from "@/lib/store";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".csv"];

export async function POST(request: Request) {
  try {
    if (process.env.UPLOADS_ENABLED === "false") {
      return NextResponse.json({ error: "Uploads are disabled" }, { status: 403 });
    }

    // PDF/Word originals stay on the client; persist only the explicitly imported text.
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json() as { name?: unknown; size?: unknown; text?: unknown };
      if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 255 || typeof body.size !== "number" || !Number.isSafeInteger(body.size) || body.size < 0 || typeof body.text !== "string" || !body.text.trim() || body.text.length > 128_000) {
        return NextResponse.json({ error: "请选择有正文的资料，单份提取文字最多 128000 字。" }, { status: 400 });
      }
      const source: KnowledgeSource = { id: `upload:${body.name}:${body.size}`, title: body.name, source: "upload", text: body.text };
      await saveMaterial(source);
      return NextResponse.json({ sources: [source] });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    const sources: KnowledgeSource[] = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const supported = SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

      if (!supported) {
        return NextResponse.json(
          { error: `不支持直接上传“${file.name}”，请在知识库的文件上传入口读取 PDF、Word 或图片。` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File is too large: ${file.name}` }, { status: 400 });
      }

      sources.push({
        id: `upload:${file.name}:${file.size}`,
        title: file.name,
        source: "upload",
        text: await file.text(),
      });
    }

    await Promise.all(sources.map((source) => saveMaterial(source)));

    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
