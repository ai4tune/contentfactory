import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function load(relativePath, dependencies = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}

const filters = await load("../modules/market/search-filters.ts");
const contracts = await load("../modules/market/providers/redfox-search.ts", { "node:crypto": crypto, "../search-filters": filters });
const input = { keyword: "咖啡店", page: 2, pageSize: 20 };

test("old clients keep the original platform search defaults", () => {
  assert.deepEqual(contracts.redfoxSearchRequest({ ...input, platform: "xiaohongshu" }).params,
    { keyword: "咖啡店", page: 2, sort: "综合", note_type: "不限", noteTime: "不限" });
  assert.deepEqual(contracts.redfoxSearchRequest({ ...input, platform: "douyin" }).params,
    { keyword: "咖啡店", offset: 20, sortType: "default" });
  assert.deepEqual(contracts.redfoxSearchRequest({ ...input, platform: "wechat" }).params,
    { keyword: "咖啡店", offset: 20, sortType: "_0" });
  assert.deepEqual(contracts.redfoxSearchRequest({ ...input, platform: "channels" }).params,
    { keyword: "咖啡店", page: 2, size: 20, sort: "综合" });
});

test("all supported sort and time choices map to documented provider parameters", () => {
  for (const sort of filters.searchFilterOptions("xiaohongshu").sorts) {
    for (const timeRange of filters.searchFilterOptions("xiaohongshu").timeRanges) {
      const { params } = contracts.redfoxSearchRequest({ ...input, platform: "xiaohongshu", sort, timeRange });
      assert.equal(params.sort, sort); assert.equal(params.noteTime, timeRange);
    }
  }
  for (const platform of ["douyin", "wechat"]) {
    assert.equal(contracts.redfoxSearchRequest({ ...input, platform, sort: "最新" }).params.sortType, "_2");
    assert.equal(contracts.redfoxSearchRequest({ ...input, platform, sort: "最热" }).params.sortType, "_4");
  }
  for (const sort of filters.searchFilterOptions("channels").sorts) {
    assert.equal(contracts.redfoxSearchRequest({ ...input, platform: "channels", sort }).params.sort, sort);
  }
});

test("date presets use Beijing calendar days and resolved windows survive later pages", () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-10-08T16:30:00Z");
  try {
    const query = { ...input, platform: "douyin", sort: "最新", timeRange: "一周内" };
    const first = contracts.redfoxSearchRequest(query).params;
    assert.equal(first.startDate, "2026-10-03"); assert.equal(first.endDate, "2026-10-09");
    assert.deepEqual(filters.searchDateRange({ timeRange: "一天内" }), { startDate: "2026-10-09", endDate: "2026-10-09" });
    const saved = { ...query, startDate: first.startDate, endDate: first.endDate };
    Date.now = () => Date.parse("2026-10-11T16:30:00Z");
    assert.equal(contracts.redfoxSearchRequest({ ...saved, page: 3 }).params.startDate, first.startDate);
    assert.equal(contracts.redfoxSearchRequest({ ...saved, page: 3 }).params.endDate, first.endDate);
    assert.equal(contracts.redfoxSearchRequest({ ...saved, page: 3 }).params.offset, 40);
  } finally { Date.now = originalNow; }
});

const invalid = [
  { platform: "xiaohongshu", sort: "最热" }, { platform: "channels", sort: "最多评论" },
  { platform: "wechat", timeRange: "一周内" }, { platform: "channels", timeRange: "一天内" },
  { platform: "xiaohongshu", timeRange: "自定义" }, { platform: "douyin", sort: null },
  { platform: "douyin", timeRange: null }, { platform: "douyin", timeRange: "自定义", startDate: "2026-02-30", endDate: "2026-03-01" },
  { platform: "douyin", timeRange: "自定义", startDate: "2026-10-08", endDate: "2026-10-01" },
  { platform: "douyin", timeRange: "自定义", startDate: "2026-10-01" },
  { platform: "douyin", timeRange: "一周内", startDate: "2026-01-01", endDate: "2026-10-08" },
  { platform: "wechat", startDate: "2026-10-01", endDate: "2026-10-08" },
  { platform: "douyin", startDate: "2026-10-01", endDate: "2026-10-08" },
];

test("unsupported filters and malformed dates fail before provider calls or persistence", async () => {
  const route = await load("../app/api/market/search/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/modules/market/ranking": {}, "@/modules/market/search-filters": filters,
    "@/modules/market/history": {}, "@/modules/market/server": { marketProvider() { assert.fail("Invalid filters must not call provider"); } },
  });
  for (const query of invalid) {
    const body = { ...input, ...query };
    assert.throws(() => contracts.redfoxSearchRequest(body));
    const response = await route.POST(new Request("http://local/api/market/search", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(response.status, 400, JSON.stringify(query));
  }
  assert.equal(filters.searchFilterError({ platform: "douyin", timeRange: "自定义", startDate: "2024-02-29", endDate: "2024-03-01" }), null);
});

test("search preserves provider order, opportunity scores, and filters in saved history", async () => {
  const items = [1, 2].map(id => ({ id: String(id), title: "测试", author: {}, metrics: { likes: id === 1 ? 0 : 100_000 }, keywords: [], capturedAt: "2026-10-08" }));
  const normalization = await load("../modules/market/normalization.ts");
  const ranking = await load("../modules/market/ranking.ts", { "./normalization": normalization });
  assert.ok(ranking.calculateOpportunityScore(items[0]).total < ranking.calculateOpportunityScore(items[1]).total);
  let providerInput, savedHistory;
  const route = await load("../app/api/market/search/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/modules/market/ranking": ranking, "@/modules/market/search-filters": filters,
    "@/modules/market/history": { saveMarketHistory: async (kind, query, result) => { savedHistory = { kind, query, items: result }; return { id: "isolated-history" }; } },
    "@/modules/market/server": {
      marketProvider: () => ({ searchWorks: async query => { providerInput = query; return items; } }),
      persistMarketItems: async items => items,
    },
  });
  const originalKey = process.env.REDFOX_API_KEY;
  process.env.REDFOX_API_KEY = "synthetic";
  try {
    const query = { ...input, platform: "douyin", sort: "最新", timeRange: "自定义", startDate: "2026-10-01", endDate: "2026-10-08" };
    const response = await route.POST(new Request("http://local/api/market/search", { method: "POST", body: JSON.stringify(query) }));
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.deepEqual(result.items.map(item => item.id), ["1", "2"]);
    assert.ok(result.items.every(item => item.opportunityScore));
    assert.deepEqual(providerInput, query);
    assert.equal(savedHistory.query.sort, "最新"); assert.equal(savedHistory.query.timeRange, "自定义");
    assert.equal(savedHistory.query.startDate, query.startDate); assert.equal(savedHistory.query.endDate, query.endDate);
    assert.deepEqual(savedHistory.items.map(item => item.id), ["1", "2"]);
    assert.equal(result.query.startDate, query.startDate);
  } finally {
    if (originalKey === undefined) delete process.env.REDFOX_API_KEY;
    else process.env.REDFOX_API_KEY = originalKey;
  }
});

test("cached results remain separate for different sorting and time conditions", async () => {
  const types = await load("../modules/market/providers/types.ts");
  const cache = new Map();
  const requests = [];
  const providerModule = await load("../modules/market/providers/redfox-provider.ts", {
    "./types": types, "node:crypto": crypto, "./redfox-search": contracts,
    "@/lib/db": {
      getProviderCache: async key => cache.get(key),
      setProviderCache: async (key, provider, endpoint, response) => cache.set(key, { response, updated_at: new Date().toISOString().replace("T", " ").replace("Z", "") }),
      saveProviderCallLog: async () => {},
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_, options) => { requests.push(JSON.parse(options.body)); return Response.json({ code: 2000, data: { workList: [] } }); };
  try {
    const provider = providerModule.createRedFoxProvider({ apiKey: "synthetic", baseUrl: "https://synthetic.invalid" });
    const query = { ...input, platform: "xiaohongshu" };
    await provider.searchWorks(query);
    await provider.searchWorks({ ...query, sort: "最新" });
    await provider.searchWorks({ ...query, sort: "最新", timeRange: "一周内" });
    await provider.searchWorks(query);
    assert.equal(requests.length, 3);
    assert.equal(cache.size, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("legacy history stays readable with default filters and zero writes", async () => {
  const legacy = [{ id: "legacy", kind: "search", query: { platform: "xiaohongshu", keyword: "旧查询", page: 2 }, items: [{ id: "old-item", body: "旧正文" }], createdAt: "2025-01-01T00:00:00Z", unknown: { preserved: true } }];
  const before = structuredClone(legacy);
  const history = await load("../modules/market/history.ts", {
    "node:crypto": crypto, "@/lib/data-directory": { dataFilePath: () => "isolated-history" },
    "@/lib/local-store/json-file": { readJsonFile: async () => legacy, updateJsonFile: async () => assert.fail("History reads must not write") },
  });
  assert.deepEqual(await history.readMarketHistory(), before);
  assert.equal((await history.findSavedMarketItem("old-item")).body, "旧正文");
  assert.equal(filters.searchFilterSummary(legacy[0].query), "综合排序 · 不限");
  assert.deepEqual(legacy, before);
});
