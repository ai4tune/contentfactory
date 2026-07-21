import { NextResponse } from "next/server";
import {
  knowledgeConnectorError,
  previewDocument,
} from "@/modules/integrations/feishu/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ document: await previewDocument(id) });
  } catch (error) {
    const response = knowledgeConnectorError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
