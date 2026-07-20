import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ articles: [...store.articles].reverse() });
}

