import { NextResponse } from "next/server";
import { isContentChannel } from "@/modules/content/types";
import { updateContentPublication } from "@/modules/drafts/server/repository";
import type { PublicationMetrics } from "@/modules/drafts/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      channel?: unknown;
      url?: unknown;
      publishedAt?: unknown;
      metrics?: Partial<PublicationMetrics>;
    };
    if (!isContentChannel(body.channel)) {
      return NextResponse.json({ error: "A valid channel is required" }, { status: 400 });
    }

    const publishedAt = normalizeDate(body.publishedAt);
    if (!publishedAt) {
      return NextResponse.json({ error: "A valid published time is required" }, { status: 400 });
    }
    const metrics = body.metrics ?? {};
    const draft = await updateContentPublication({
      draftId: id,
      channel: body.channel,
      url: optionalString(body.url),
      publishedAt,
      metrics: {
        views: toCount(metrics.views),
        likes: toCount(metrics.likes),
        saves: toCount(metrics.saves),
        comments: toCount(metrics.comments),
        replies: toCount(metrics.replies),
      },
    });
    if (!draft) {
      return NextResponse.json({ error: "Draft or generated channel not found" }, { status: 404 });
    }

    const publication = draft.publications.find((item) => item.channel === body.channel);
    return NextResponse.json({ draft, publication });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publication update failed" },
      { status: 500 },
    );
  }
}

function optionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}
