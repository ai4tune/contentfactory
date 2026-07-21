import { POST as search } from "@/app/api/knowledge/search/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return search(request);
}
