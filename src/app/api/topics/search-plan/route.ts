import { NextResponse } from "next/server";
import { analyzeTopicRadar } from "@/lib/ai";
import { saveTopicRadar } from "@/lib/store";
import { checkCaptureAccess } from "@/modules/positioning/capture-access";
import { getActiveAccountContext } from "@/modules/positioning/service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  const access = checkCaptureAccess(request, true);
  return new NextResponse(null, {
    status: access.allowed ? 204 : 403,
    headers: access.corsHeaders,
  });
}

export async function POST(request: Request) {
  const access = checkCaptureAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Capture origin is not allowed" },
      { status: 403, headers: access.corsHeaders },
    );
  }

  try {
    const account = await getActiveAccountContext();
    if (!account || account.status !== "confirmed") {
      return NextResponse.json(
        { error: "请先在内容工厂完成并确认账号定位" },
        { status: 409, headers: access.corsHeaders },
      );
    }
    const input = {
      accountPosition: account.accountPosition,
      targetAudience: account.targetAudience.join("、"),
      offer: account.offer,
      platforms: "小红书",
      keywordSeeds: [...account.contentDirections, ...account.recommendedTopics].join("、"),
      contentGoal: account.conversionGoal,
      accountContext: account,
    };
    const result = await analyzeTopicRadar(input);
    await saveTopicRadar(input, result);
    const candidates = [
      ...result.searchTasks
        .filter((task) => task.platform.includes("小红书"))
        .map((task) => ({ query: task.query, why: task.why, group: "搜索任务" })),
      ...result.keywordGroups.flatMap((group) => group.keywords.map((query) => ({
        query,
        why: group.intent,
        group: group.group,
      }))),
    ];
    const seen = new Set<string>();
    const keywords = candidates.filter((item) => {
      const query = item.query.trim();
      if (!query || seen.has(query)) return false;
      seen.add(query);
      return true;
    }).slice(0, 12);
    if (!keywords.length) throw new Error("AI 没有返回可用长尾词，请检查账号定位后重试");

    return NextResponse.json({
      plan: {
        accountName: account.accountName,
        accountPosition: account.accountPosition,
        keywords,
      },
    }, { headers: access.corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "长尾词推荐失败" },
      { status: 500, headers: access.corsHeaders },
    );
  }
}
