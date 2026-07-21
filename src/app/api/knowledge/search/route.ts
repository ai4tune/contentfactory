import { NextResponse } from "next/server";
import {
  knowledgeConnectorError,
  searchKnowledge,
} from "@/modules/integrations/feishu/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: unknown };
    if (typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json({ error: "请输入搜索关键词。" }, { status: 400 });
    }

    return NextResponse.json({ items: await searchKnowledge(body.query) });
  } catch (error) {
    const response = knowledgeConnectorError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
