import { readCloudState, updateCloudState } from "@/lib/cloud-state";
import type { MarketAccount, MarketItem } from "@/modules/market/types";

export type TrackedAccountBundle = { account: MarketAccount; items: MarketItem[] };

type MarketItemInput = {
  id: string;
  provider: string;
  providerItemId?: string;
  platform: string;
  platformContentId?: string;
  canonicalUrl?: string;
  sourceUrl?: string;
  title: string;
  summary?: string;
  body?: string;
  contentType: string;
  authorId?: string;
  authorName?: string;
  authorFollowers?: number;
  authorProfileUrl?: string;
  publishedAt?: string;
  capturedAt: string;
  views?: number;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  keywords?: string[];
  tags?: string[];
  rawPayloadRef?: string;
  opportunityScore?: number;
};

export type ProviderCallLogInput = {
  provider: string;
  endpoint: string;
  model?: string;
  startedAt: string;
  finishedAt: string;
  durationMs?: number;
  success: boolean;
  cacheHit: boolean;
  itemCount: number;
  inputUnits?: number;
  outputUnits?: number;
  costEstimate?: number;
  errorCode?: string;
  errorMessage?: string;
};

type IdeaInput = {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  platform?: string;
  marketItemId?: string;
  inspirationId?: string;
  status?: string;
};

const trackedKey = "db:tracked-account-bundles";
const marketKey = "db:market-items";
const logsKey = "db:provider-call-logs";
const cacheKey = "db:provider-cache";
const ideasKey = "db:ideas";

export async function listTrackedAccountBundles() {
  return (await readCloudState(trackedKey, { bundles: [] as TrackedAccountBundle[] })).bundles;
}

export async function saveTrackedAccountBundle(bundle: TrackedAccountBundle) {
  await updateCloudState(trackedKey, { bundles: [] as TrackedAccountBundle[] }, (state) => ({
    bundles: [bundle, ...state.bundles.filter((item) => item.account.id !== bundle.account.id)],
  }));
}

export async function deleteTrackedAccountBundle(id: string) {
  await updateCloudState(trackedKey, { bundles: [] as TrackedAccountBundle[] }, (state) => ({
    bundles: state.bundles.filter((item) => item.account.id !== id),
  }));
}

export async function saveMarketItemToDb(item: MarketItemInput) {
  await updateCloudState(marketKey, { items: [] as Record<string, unknown>[] }, (state) => ({
    items: [marketItemRow(item), ...state.items.filter((row) => row.id !== item.id)],
  }));
}

export async function upsertMarketItemToDb(item: MarketItemInput) {
  let savedId = item.id;
  await updateCloudState(marketKey, { items: [] as Record<string, unknown>[] }, (state) => {
    const existing = state.items.find((row) => (
      item.platformContentId
        ? row.platform === item.platform && row.platform_content_id === item.platformContentId
        : row.id === item.id
    )) ?? state.items.find((row) => row.id === item.id);
    savedId = typeof existing?.id === "string" ? existing.id : item.id;
    const row = existing ? mergeMarketItem(existing, item, savedId) : marketItemRow(item);
    return { items: [row, ...state.items.filter((candidate) => candidate.id !== savedId)] };
  });
  return savedId;
}

export async function getMarketItemFromDb(id: string) {
  const state = await readCloudState(marketKey, { items: [] as Record<string, unknown>[] });
  return state.items.find((row) => row.id === id) ?? null;
}

export async function listMarketItemsFromDb(filters?: {
  platform?: string;
  keyword?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}) {
  const state = await readCloudState(marketKey, { items: [] as Record<string, unknown>[] });
  const keyword = filters?.keyword?.toLocaleLowerCase("zh-CN");
  const rows = state.items
    .filter((row) => !filters?.platform || row.platform === filters.platform)
    .filter((row) => !keyword || [row.title, row.summary, row.keywords].some((value) => String(value ?? "").toLocaleLowerCase("zh-CN").includes(keyword)))
    .filter((row) => !filters?.minScore || Number(row.opportunity_score ?? 0) >= filters.minScore)
    .sort((left, right) => String(right.captured_at ?? "").localeCompare(String(left.captured_at ?? "")));
  const offset = filters?.offset ?? 0;
  return rows.slice(offset, filters?.limit ? offset + filters.limit : undefined);
}

export async function saveProviderCallLog(log: ProviderCallLogInput) {
  const row = {
    id: crypto.randomUUID(),
    provider: log.provider,
    endpoint: log.endpoint,
    model: log.model ?? null,
    started_at: log.startedAt,
    finished_at: log.finishedAt,
    duration_ms: log.durationMs ?? null,
    success: log.success,
    cache_hit: log.cacheHit,
    item_count: log.itemCount,
    input_units: log.inputUnits ?? null,
    output_units: log.outputUnits ?? null,
    cost_estimate: log.costEstimate ?? null,
    error_code: log.errorCode ?? null,
    error_message: log.errorMessage ?? null,
  };
  await updateCloudState(logsKey, { logs: [] as Array<typeof row> }, (state) => ({
    logs: [row, ...state.logs].slice(0, 10_000),
  }));
}

export async function getOperationSummary(days = 7) {
  const safeDays = Math.min(90, Math.max(1, Math.trunc(days)));
  const since = new Date(Date.now() - safeDays * 86_400_000).toISOString();
  const state = await readCloudState(logsKey, { logs: [] as Array<Record<string, unknown>> });
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of state.logs.filter((item) => String(item.started_at) >= since)) {
    const service = row.provider === "redfox" ? "market" : String(row.provider);
    grouped.set(service, [...(grouped.get(service) ?? []), row]);
  }
  const services = [...grouped.entries()].map(([service, rows]) => {
    const durations = rows.map((row) => row.duration_ms).filter((value): value is number => typeof value === "number");
    return {
      service,
      calls: rows.length,
      failures: rows.filter((row) => !row.success).length,
      averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      estimatedCost: rows.reduce((sum, row) => sum + (typeof row.cost_estimate === "number" ? row.cost_estimate : 0), 0),
    };
  }).sort((left, right) => right.calls - left.calls);
  return {
    since,
    totals: {
      calls: services.reduce((sum, item) => sum + item.calls, 0),
      failures: services.reduce((sum, item) => sum + item.failures, 0),
      estimatedCost: services.reduce((sum, item) => sum + item.estimatedCost, 0),
    },
    services,
  };
}

export async function getProviderCache(key: string) {
  const state = await readCloudState(cacheKey, { entries: {} as Record<string, Record<string, unknown>> });
  return state.entries[key] ?? null;
}

export async function setProviderCache(key: string, provider: string, endpoint: string, response: string, statusCode = 200) {
  await updateCloudState(cacheKey, { entries: {} as Record<string, Record<string, unknown>> }, (state) => ({
    entries: {
      ...state.entries,
      [key]: {
        cache_key: key,
        provider,
        endpoint,
        response,
        status_code: statusCode,
        updated_at: new Date().toISOString(),
      },
    },
  }));
}

export async function cleanupExpiredCache(maxAgeHours = 24) {
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  let removed = 0;
  await updateCloudState(cacheKey, { entries: {} as Record<string, Record<string, unknown>> }, (state) => ({
    entries: Object.fromEntries(Object.entries(state.entries).filter(([, row]) => {
      const keep = Date.parse(String(row.updated_at ?? 0)) >= cutoff;
      if (!keep) removed += 1;
      return keep;
    })),
  }));
  return removed;
}

export async function saveIdeaToDb(idea: IdeaInput) {
  const now = new Date().toISOString();
  const row = {
    id: idea.id,
    title: idea.title,
    summary: idea.summary ?? null,
    source_url: idea.sourceUrl ?? null,
    platform: idea.platform ?? null,
    market_item_id: idea.marketItemId ?? null,
    inspiration_id: idea.inspirationId ?? null,
    status: idea.status ?? "pool",
    created_at: now,
    updated_at: now,
  };
  await updateCloudState(ideasKey, { ideas: [] as Array<Record<string, unknown>> }, (state) => ({
    ideas: [row, ...state.ideas.filter((item) => item.id !== idea.id)],
  }));
}

export async function getIdeaFromDb(id: string) {
  return (await readCloudState(ideasKey, { ideas: [] as Array<Record<string, unknown>> })).ideas
    .find((idea) => idea.id === id) ?? null;
}

export async function listIdeasFromDb(status?: string) {
  const ideas = (await readCloudState(ideasKey, { ideas: [] as Array<Record<string, unknown>> })).ideas;
  return ideas.filter((idea) => !status || idea.status === status);
}

export async function updateIdeaStatus(id: string, status: string) {
  await updateCloudState(ideasKey, { ideas: [] as Array<Record<string, unknown>> }, (state) => ({
    ideas: state.ideas.map((idea) => idea.id === id ? { ...idea, status, updated_at: new Date().toISOString() } : idea),
  }));
}

function marketItemRow(item: MarketItemInput): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: item.id,
    provider: item.provider,
    provider_item_id: item.providerItemId ?? null,
    platform: item.platform,
    platform_content_id: item.platformContentId ?? null,
    canonical_url: item.canonicalUrl ?? null,
    source_url: item.sourceUrl ?? null,
    title: item.title,
    summary: item.summary ?? null,
    body: item.body ?? null,
    content_type: item.contentType,
    author_id: item.authorId ?? null,
    author_name: item.authorName ?? null,
    author_followers: item.authorFollowers ?? null,
    author_profile_url: item.authorProfileUrl ?? null,
    published_at: item.publishedAt ?? null,
    captured_at: item.capturedAt,
    views: item.views ?? null,
    likes: item.likes ?? null,
    collects: item.collects ?? null,
    comments: item.comments ?? null,
    shares: item.shares ?? null,
    keywords: item.keywords ? JSON.stringify(item.keywords) : null,
    tags: item.tags ? JSON.stringify(item.tags) : null,
    raw_payload_ref: item.rawPayloadRef ?? null,
    opportunity_score: item.opportunityScore ?? null,
    created_at: now,
    updated_at: now,
  };
}

function mergeMarketItem(existing: Record<string, unknown>, item: MarketItemInput, id: string) {
  const next = marketItemRow({ ...item, id });
  return {
    ...existing,
    ...next,
    body: existing.body || next.body,
    summary: next.summary ?? existing.summary,
    source_url: next.source_url ?? existing.source_url,
    canonical_url: next.canonical_url ?? existing.canonical_url,
    author_name: next.author_name ?? existing.author_name,
    author_followers: next.author_followers ?? existing.author_followers,
    published_at: next.published_at ?? existing.published_at,
    created_at: existing.created_at,
  };
}
