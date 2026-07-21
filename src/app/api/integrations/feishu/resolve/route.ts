import { NextResponse } from "next/server";
import {
  knowledgeConnectorError,
  resolveKnowledgeUrl,
} from "@/modules/integrations/feishu/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "请粘贴飞书文档或多维表格链接。" }, { status: 400 });
    }

    return NextResponse.json({ document: await resolveKnowledgeUrl(body.url.trim()) });
  } catch (error) {
    const response = knowledgeConnectorError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
