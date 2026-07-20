import { NextResponse } from "next/server";
import { updateArticlePublication, type PublicationMetrics } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { url?: string; publishedAt?: string; metrics?: Partial<PublicationMetrics> };
  const metrics = body.metrics ?? {};
  const article = await updateArticlePublication(id, {
    url: body.url,
    publishedAt: body.publishedAt,
    metrics: {
      views: toCount(metrics.views), likes: toCount(metrics.likes), saves: toCount(metrics.saves),
      comments: toCount(metrics.comments), replies: toCount(metrics.replies),
    },
  });

  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  return NextResponse.json({ article });
}

function toCount(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number) : 0; }

