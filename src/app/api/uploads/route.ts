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

    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    const sources: KnowledgeSource[] = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const supported = SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

      if (!supported) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name}. Use txt, md, or csv for this spike.` },
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
