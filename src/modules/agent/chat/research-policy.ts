import type { ToolRecord } from "./types";
import type { ResearchRecord } from "@/modules/research/types";

// Read only the original user request, never search snippets or model arguments.
export function webQueryLimit(content: string): number | undefined {
  const text = content.normalize("NFKC");
  const subject = "(?:网页搜索|联网搜索|网络搜索|搜索网页|搜索公开网页|上网搜索|Brave(?:\\s*搜索)?)";
  const quantity = "([0-9]+|[零一二两三四五六七八九十]+)";
  const limits: number[] = [];
  const chinese: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const count = (value: string) => value.includes("十") ? (chinese[value.split("十")[0]] ?? 1) * 10 + (chinese[value.split("十")[1]] ?? 0) : chinese[value] ?? Number(value);
  for (const pattern of [`${quantity}\\s*次\\s*(?:的\\s*)?${subject}`, `${subject}\\s*(?:(?:最多|不超过|至多|仅|只|做|用|查|进行)\\s*)*${quantity}\\s*次`]) {
    for (const match of text.matchAll(new RegExp(pattern, "gi"))) {
      if (/(?:第|至少|不只|不止|不是)\s*$/.test(text.slice(0, match.index))) continue;
      const limit = count(match[1]); if (Number.isFinite(limit)) limits.push(limit);
    }
  }
  for (const match of text.matchAll(/\b(\d+|one|two|three|four)\s+web\s+search(?:es)?\b/gi)) {
    limits.push(({ one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[match[1].toLowerCase()] ?? Number(match[1]));
  }
  if (/(?:不(?:要|用|再)?|禁止)\s*(?:进行\s*)?(?:网页搜索|联网搜索|网络搜索|搜索网页|上网搜索)/.test(text)) limits.push(0);
  return limits.length ? Math.min(4, ...limits) : undefined;
}

export function externalAttempts(record: ToolRecord): number {
  if (record.externalAttempts !== undefined) return record.externalAttempts;
  // Old checkpoints are interpreted on read, not migrated. These rejections precede HTTP.
  return record.status === "failed" && [400, 404, 409, 503].includes(record.errorStatus ?? 0) ? 0 : 1;
}

export function webAttempts(records: ToolRecord[]) {
  return records.filter((item) => item.name === "search_web").reduce((total, item) => total + externalAttempts(item), 0);
}

export function canCorrectPlaceReference(item: ToolRecord, research: ResearchRecord[]) {
  return item.name === "read_place" && item.status === "failed" && (item.errorStatus === 400 || (item.errorStatus === undefined
    && research.some((record) => String(item.input.sourceId).startsWith(`${record.id}:source:`)
      && !record.sources.some((source) => source.id === item.input.sourceId))));
}

export function recoveryFeedback(records: ToolRecord[], name: string, input: Record<string, unknown>) {
  const queries = records.filter((item) => item.name === name);
  if (!queries.length) return undefined;
  return {
    requestedQueryNotExecuted: true,
    message: "继续处理沿用原任务的查询。已完成的结果请直接复用，未完成的查询沿用原参数；追加或更换查询条件需作为新的用户诉求。下面是原查询及进度，不是本次新查询结果。",
    requestedInput: input,
    completedQueries: queries.filter((item) => item.status === "succeeded").map(({ input, output }) => ({ input, output })),
    pendingQueries: queries.filter((item) => item.status !== "succeeded").map(({ input, error }) => ({ input, error })),
  };
}
