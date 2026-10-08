import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

// Run the real services against isolated dependencies; never load production credentials.
async function load(relativePath, dependencies) {
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

test("cover generation trims configuration and uses one /v1 for every supported base URL", async () => {
  const env = { IMAGE_MODEL: " gpt-image-2\n", IMAGE_API_KEY: " synthetic-key\r\n" };
  const logs = [];
  const images = await load("../modules/content/image-service.ts", {
    "@/lib/ai": {}, "@/lib/config": { requireEnv: (key) => env[key] },
    "@/lib/db": { saveProviderCallLog: async (log) => logs.push(log) },
  });
  const originalFetch = globalThis.fetch;
  const originalSize = process.env.IMAGE_SIZE;
  process.env.IMAGE_SIZE = " 1024x1536\n";
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).href, "https://images.example/v1/images/generations");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer synthetic-key");
    assert.deepEqual(JSON.parse(options.body), { model: "gpt-image-2", prompt: "测试背景", n: 1, size: "1024x1536" });
    return Response.json({ data: [{ url: "http://img.xingren.me/images/synthetic.png" }] });
  };
  try {
    for (const base of ["https://images.example", "https://images.example/v1", "https://images.example/v1/", "https://images.example/v1/images/generations/"]) {
      env.IMAGE_BASE_URL = ` ${base}\r\n`;
      const result = await images.retryXiaohongshuVisualAsset({ id: "existing-cover", kind: "cover", title: "测试", prompt: "测试背景" });
      assert.equal(result.status, "generated", result.error);
      assert.equal(result.id, "existing-cover");
      assert.equal(result.imageUrl, "https://img.xingren.me/images/synthetic.png");
    }
    assert.equal(logs.length, 4);
    assert.ok(logs.every((log) => log.success && log.model === "gpt-image-2"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSize === undefined) delete process.env.IMAGE_SIZE;
    else process.env.IMAGE_SIZE = originalSize;
  }
});

async function marketFixture() {
  const workspace = new AsyncLocalStorage();
  const rows = new Map();
  let writes = 0, conflicts = 0, blockedWrites = 0, readOnly = false;
  const key = (workspaceId, storeKey) => `${workspaceId}:${storeKey}`;
  const supabase = { from(table) {
    assert.equal(table, "content_factory_state");
    const filters = {};
    let patch;
    const query = {
      select() { return query; },
      eq(name, value) { filters[name] = value; return query; },
      update(value) { patch = value; return query; },
      async insert(value) {
        if (readOnly) { blockedWrites++; throw new Error("Read-only fixture"); }
        await delay(1);
        const id = key(value.workspace_id, value.store_key);
        if (rows.has(id)) return { error: { code: "23505" } };
        rows.set(id, structuredClone(value)); writes++;
        return { error: null };
      },
      async maybeSingle() {
        const id = key(filters.workspace_id, filters.store_key);
        if (!patch) {
          const snapshot = structuredClone(rows.get(id) ?? null);
          await delay(1);
          return { data: snapshot, error: null };
        }
        if (readOnly) { blockedWrites++; throw new Error("Read-only fixture"); }
        await delay(1);
        const current = rows.get(id);
        if (current?.version !== filters.version) { conflicts++; return { data: null, error: null }; }
        rows.set(id, { ...current, ...structuredClone(patch) }); writes++;
        return { data: { version: patch.version }, error: null };
      },
    };
    return query;
  } };
  const state = await load("../lib/cloud-state.ts", {
    "@/lib/supabase/admin": { createAdminSupabaseClient: () => supabase },
    "@/lib/data-workspace": { getDataWorkspaceId: async () => workspace.getStore() },
    react: { cache: (fn) => fn },
  });
  const cloud = await load("../lib/db.cloud.ts", { "@/lib/cloud-state": state });
  const db = await load("../lib/db.ts", {
    "./db.cloud": cloud, "./db.local": {},
    "./supabase/config": { isSupabaseAuthConfigured: () => true, isSupabasePersistenceConfigured: () => true },
  });
  const market = await load("../modules/market/server.ts", {
    "./providers/redfox-provider": {}, "@/lib/db": db,
  });
  return { rows, db, market, run: (id, fn) => workspace.run(id, fn),
    get writes() { return writes; }, get conflicts() { return conflicts; }, get blockedWrites() { return blockedWrites; },
    setReadOnly() { readOnly = true; },
  };
}

const items = (prefix) => Array.from({ length: 20 }, (_, index) => ({
  id: `${prefix}-${index}`, provider: "redfox", platform: "xiaohongshu", platformContentId: `${prefix}-${index}`,
  title: `结果 ${index}`, contentType: "image", capturedAt: "2026-10-08T00:00:00Z",
  author: { name: "测试作者" }, metrics: { likes: index }, keywords: ["测试"], tags: [],
}));

test("20 search results save completely without exhausting cloud conflict retries", async () => {
  const fixture = await marketFixture();
  const input = items("search");
  const saved = await fixture.run("alice", () => fixture.market.persistMarketItems(input));
  assert.deepEqual(saved.map((item) => item.id), input.map((item) => item.id));
  assert.ok(saved.every((item) => item.provider === "market-data"));
  const stored = await fixture.run("alice", () => fixture.db.listMarketItemsFromDb());
  assert.equal(stored.length, 20);
  assert.equal(fixture.writes, 1);
});

test("filtered search keeps provider order and saves all 20 cloud results in one update", async () => {
  const fixture = await marketFixture();
  const filters = await load("../modules/market/search-filters.ts", {});
  const normalization = await load("../modules/market/normalization.ts", {});
  const ranking = await load("../modules/market/ranking.ts", { "./normalization": normalization });
  const input = items("filtered");
  let savedHistory;
  const route = await load("../app/api/market/search/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/modules/market/ranking": ranking, "@/modules/market/search-filters": filters,
    "@/modules/market/history": { saveMarketHistory: async (kind, query, result) => {
      savedHistory = { kind, query, items: result }; return { id: "isolated-history" };
    } },
    "@/modules/market/server": { ...fixture.market, marketProvider: () => ({ searchWorks: async query => {
      assert.equal(query.sort, "最新"); assert.equal(query.timeRange, "一周内");
      assert.equal(query.page, 2); return input;
    } }) },
  });
  const previousKey = process.env.REDFOX_API_KEY;
  process.env.REDFOX_API_KEY = "synthetic";
  try {
    const query = { platform: "xiaohongshu", keyword: "隔离测试", sort: "最新", timeRange: "一周内", page: 2 };
    const response = await fixture.run("alice", () => route.POST(new Request("http://local/api/market/search", {
      method: "POST", body: JSON.stringify(query),
    })));
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.deepEqual(result.items.map(item => item.id), input.map(item => item.id));
    assert.ok(result.items.every(item => item.opportunityScore && item.provider === "market-data"));
    assert.equal(savedHistory.query.sort, query.sort); assert.equal(savedHistory.query.timeRange, query.timeRange);
    assert.deepEqual(savedHistory.items.map(item => item.id), input.map(item => item.id));
    assert.equal((await fixture.run("alice", () => fixture.db.listMarketItemsFromDb())).length, 20);
    assert.equal(fixture.writes, 1);
  } finally {
    if (previousKey === undefined) delete process.env.REDFOX_API_KEY;
    else process.env.REDFOX_API_KEY = previousKey;
  }
});

test("simultaneous searches keep all results and existing saved identities and fields", async () => {
  const fixture = await marketFixture();
  const legacy = { id: "saved-original-id", platform: "xiaohongshu", platform_content_id: "a-0",
    body: "旧正文", created_at: "2025-01-01T00:00:00Z", custom_field: { preserved: true } };
  const unrelated = { id: "old-unrelated", platform: "wechat", body: "旧资料", updated_at: "2025-02-01T00:00:00Z" };
  fixture.rows.set("alice:db:market-items", { workspace_id: "alice", store_key: "db:market-items", version: 7, payload: { items: [legacy, unrelated] } });
  const [a, b, bob] = await Promise.all([
    fixture.run("alice", () => fixture.market.persistMarketItems(items("a"))),
    fixture.run("alice", () => fixture.market.persistMarketItems(items("b"))),
    fixture.run("bob", () => fixture.market.persistMarketItems(items("a"))),
  ]);
  assert.equal(a[0].id, legacy.id);
  assert.equal(b.length, 20); assert.equal(bob[0].id, "a-0");
  const aliceRows = await fixture.run("alice", () => fixture.db.listMarketItemsFromDb());
  assert.equal(aliceRows.length, 41);
  assert.ok(fixture.conflicts > 0, "concurrent searches must exercise version-conflict retry");
  const restored = await fixture.run("alice", () => fixture.db.getMarketItemFromDb(legacy.id));
  assert.equal(restored.body, legacy.body); assert.equal(restored.created_at, legacy.created_at);
  assert.deepEqual(restored.custom_field, legacy.custom_field);
  assert.deepEqual(aliceRows.find((row) => row.id === unrelated.id), unrelated);
  const bobRows = await fixture.run("bob", () => fixture.db.listMarketItemsFromDb());
  assert.equal(bobRows.length, 20); assert.ok(bobRows.every((row) => row.id.startsWith("a-")));
});

test("reading legacy market data preserves payload, version, timestamp and ownership with zero writes", async () => {
  const fixture = await marketFixture();
  const row = { workspace_id: "alice", store_key: "db:market-items", version: 12, updated_at: "2025-01-01T00:00:00Z",
    payload: { items: [{ id: "legacy", title: "旧结果", body: "旧正文", unknown: ["保留"] }] } };
  fixture.rows.set("alice:db:market-items", structuredClone(row));
  fixture.setReadOnly();
  await fixture.run("alice", async () => {
    assert.deepEqual(await fixture.db.getMarketItemFromDb("legacy"), row.payload.items[0]);
    assert.deepEqual(await fixture.db.listMarketItemsFromDb(), row.payload.items);
  });
  assert.equal(await fixture.run("bob", () => fixture.db.getMarketItemFromDb("legacy")), null);
  assert.equal(fixture.writes, 0); assert.equal(fixture.blockedWrites, 0);
  assert.deepEqual(fixture.rows.get("alice:db:market-items"), row);
});

test("failed batch saving leaves every existing record and version intact", async () => {
  const fixture = await marketFixture();
  const row = { workspace_id: "alice", store_key: "db:market-items", version: 3,
    payload: { items: [{ id: "legacy", title: "旧结果", body: "旧正文" }] } };
  fixture.rows.set("alice:db:market-items", structuredClone(row));
  fixture.setReadOnly();
  await assert.rejects(fixture.run("alice", () => fixture.market.persistMarketItems(items("new"))), /Read-only fixture/);
  assert.equal(fixture.writes, 0);
  assert.equal(fixture.blockedWrites, 1);
  assert.deepEqual(fixture.rows.get("alice:db:market-items"), row);
});

test("empty batches do not write and duplicate works retain one stable saved ID", async () => {
  const fixture = await marketFixture();
  assert.deepEqual(await fixture.run("alice", () => fixture.market.persistMarketItems([])), []);
  assert.equal(fixture.writes, 0);
  const first = items("duplicate")[0];
  const saved = await fixture.run("alice", () => fixture.market.persistMarketItems([first, { ...first, id: "another-provider-id" }]));
  assert.deepEqual(saved.map((item) => item.id), [first.id, first.id]);
  assert.equal((await fixture.run("alice", () => fixture.db.listMarketItemsFromDb())).length, 1);
});

test("local database mode keeps its existing per-item persistence behavior", async () => {
  const calls = [];
  const db = await load("../lib/db.ts", {
    "./db.cloud": {}, "./db.local": { upsertMarketItemToDb: (item) => { calls.push(item); return `saved-${item.id}`; } },
    "./supabase/config": { isSupabaseAuthConfigured: () => false, isSupabasePersistenceConfigured: () => false },
  });
  const input = items("local");
  assert.deepEqual(await db.upsertMarketItemsToDb(input), input.map((item) => `saved-${item.id}`));
  assert.deepEqual(calls, input);
});
