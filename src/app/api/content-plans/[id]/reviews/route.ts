import { NextResponse } from "next/server";
import { listWeeklyReviews } from "@/modules/reviews/weekly/repository";
import { getContentPlan } from "@/modules/plans/repository";
import {
  confirmReview,
  generateWeeklyReview,
  WeeklyReviewError,
} from "@/modules/reviews/weekly/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!await getContentPlan(id)) {
    return NextResponse.json({ error: "内容计划不存在。" }, { status: 404 });
  }
  return NextResponse.json({ reviews: await listWeeklyReviews(id) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action === "confirm") {
      const reviewId = String(body.reviewId ?? "").trim();
      if (!reviewId) throw new WeeklyReviewError("缺少要确认的周复盘。");
      return NextResponse.json({ review: await confirmReview(id, reviewId) });
    }
    const week = Number(body.week);
    if (!Number.isInteger(week) || week < 1 || week > 5) {
      throw new WeeklyReviewError("周次必须是 1 到 5 的整数。");
    }
    return NextResponse.json({ review: await generateWeeklyReview(id, week) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "周复盘生成失败。" },
      { status: error instanceof WeeklyReviewError ? error.status : 500 },
    );
  }
}
