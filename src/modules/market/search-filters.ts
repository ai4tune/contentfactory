import type { MarketPlatform, SearchWorksInput, SearchSort, SearchTimeRange } from "./types";

const recentRanges: SearchTimeRange[] = ["不限", "一天内", "一周内", "一个月内", "一年内"];
const rangeDays: Partial<Record<SearchTimeRange, number>> = { "一天内": 1, "一周内": 7, "一个月内": 30, "一年内": 365 };
const options: Record<string, { sorts: SearchSort[]; timeRanges: SearchTimeRange[] }> = {
  xiaohongshu: { sorts: ["综合", "最新", "最多点赞", "最多评论", "最多收藏"], timeRanges: recentRanges },
  douyin: { sorts: ["综合", "最新", "最热"], timeRanges: [...recentRanges, "自定义"] },
  wechat: { sorts: ["综合", "最新", "最热"], timeRanges: ["不限"] },
  channels: { sorts: ["综合", "最新", "最多点赞", "最多收藏"], timeRanges: ["不限"] },
};

export function searchFilterOptions(platform: MarketPlatform) {
  return options[platform] ?? { sorts: ["综合"] as SearchSort[], timeRanges: ["不限"] as SearchTimeRange[] };
}

export function searchFilterError(input: Pick<SearchWorksInput, "platform" | "sort" | "timeRange" | "startDate" | "endDate">) {
  const supported = options[input.platform];
  if (!supported || !supported.sorts.includes(input.sort === undefined ? "综合" : input.sort)) return "请选择该平台支持的排序方式。";
  if (!supported.timeRanges.includes(input.timeRange === undefined ? "不限" : input.timeRange)) return "请选择该平台支持的发布时间范围。";
  if (input.timeRange === "自定义" || (input.platform === "douyin" && (input.timeRange ?? "不限") !== "不限" && (input.startDate !== undefined || input.endDate !== undefined))) {
    if (!validDate(input.startDate) || !validDate(input.endDate) || input.startDate > input.endDate) {
      return "请填写有效的开始和结束日期，开始日期不能晚于结束日期。";
    }
    const days = rangeDays[input.timeRange ?? "不限"];
    if (days && Date.parse(input.endDate) - Date.parse(input.startDate) !== (days - 1) * 86_400_000) {
      return "日期区间与所选发布时间范围不匹配。";
    }
  } else if (input.startDate !== undefined || input.endDate !== undefined) {
    return "开始和结束日期仅用于自定义发布时间范围。";
  }
  return null;
}

export function searchDateRange(input: Pick<SearchWorksInput, "timeRange" | "startDate" | "endDate">) {
  if (input.startDate && input.endDate) return { startDate: input.startDate, endDate: input.endDate };
  const days = rangeDays[input.timeRange ?? "不限"];
  if (!days) return {};
  const end = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const start = new Date(Date.parse(end) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}

export function searchFilterSummary(input: Pick<SearchWorksInput, "sort" | "timeRange" | "startDate" | "endDate">) {
  return `${input.sort ?? "综合"}排序 · ${input.timeRange === "自定义" ? `${input.startDate} 至 ${input.endDate}` : input.timeRange ?? "不限"}`;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
