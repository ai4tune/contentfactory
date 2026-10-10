import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.AMAP_TEST_PORT || 4596), base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("contentfactory:amap-test").toString("base64")}`;
const requests = [], children = [];
let directory, app, service, env, logs = "", places;
const poi = (id, name, location, extra = {}) => ({ id, name, location, cityname: "天津市", adname: "验收区", address: "合成测试地址", type: "餐饮服务;咖啡厅", ...extra });
const respond = (response, body, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "contentfactory-amap-test-"));
  service = http.createServer((request, response) => {
    const url = new URL(request.url, "http://fixture");
    const query = Object.fromEntries(url.searchParams); requests.push({ path: url.pathname, query });
    if (url.pathname === "/res/v1/web/search") return respond(response, { type: "search", web: { results: [{ title: "合成官方账号候选", url: "https://example.org/store", description: "待核对门店身份" }] } });
    assert.equal(query.key, "synthetic-amap-secret");
    if (query.keywords === "denied") return respond(response, { status: "0", infocode: "10001", info: "synthetic-amap-secret" });
    if (query.keywords === "httpfail") return respond(response, { error: "synthetic-amap-secret" }, 429);
    if (query.keywords === "malformed") return respond(response, { status: "1", infocode: "10000", pois: {} });
    if (query.keywords === "badcoords") return respond(response, { status: "1", infocode: "10000", pois: [poi("B_BAD", "坏坐标", "invalid")] });
    if (query.keywords === "empty") return respond(response, { status: "1", infocode: "10000", count: "0", pois: [] });
    const rows = url.pathname.endsWith("/text") ? [poi("B_CENTER1", "验收广场一店 synthetic-amap-secret", "117.200000123,39.120000987", { type: "商务住宅;楼宇;商务写字楼", business: { cost: "53292", rating: "4.7" } }), poi("B_CENTER2", "验收广场二店", "117.21,39.12"), poi("B_CENTER1", "重复", "117.2,39.12"), poi("B_INVALID", "经纬度超限", "500,39")]
      : url.pathname.endsWith("/around") ? [poi("B_FAR", "远店", "117.205,39.12", { distance: "900" }), poi("B_NEAR", "近店", "117.201,39.12", { distance: "100", business: { rating: "4.5", cost: "35", opentime_week: "周一至周日 9-18时", business_area: "验收商圈" } }), poi("B_UNKNOWN", "字段缺失店", "117.204,39.12", { distance: [], business: { rating: [], cost: "" } }), poi("B_OUTSIDE", "范围外", "118.2,39.12", { distance: "1" }), poi("B_RADIUS", "距离超范围", "117.21,39.12", { distance: "6000" })]
      : [poi(query.id, "详情店", "117.201,39.12", { business: { rating: "4.2", cost: "0", opentime_today: "9-18时", tel: "do-not-collect-phone" }, photos: [{ url: "https://example.org/not-owned-photo.jpg" }] })];
    return respond(response, { status: "1", infocode: "10000", count: "9999", pois: rows });
  });
  await new Promise((resolve) => service.listen(0, "127.0.0.1", resolve));
  env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_CODE: "amap-test", HOSTNAME: "127.0.0.1", PORT: String(port), AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock", MOCK_AI_PORT: String(port + 1), AMAP_API_KEY: "synthetic-amap-secret", AMAP_BASE_URL: `http://127.0.0.1:${service.address().port}`, WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: base };
  env.BRAVE_API_KEY = "synthetic-brave-secret"; env.BRAVE_SEARCH_BASE_URL = env.AMAP_BASE_URL;
  start("src/tests/mock-ai-gateway.mjs"); await waitFor(`http://127.0.0.1:${port + 1}/health`);
  app = start(".next/standalone/server.js"); await waitFor(`${base}/api/health`);
});
after(async () => { for (const child of children.reverse()) await stop(child); service.closeAllConnections(); await new Promise((resolve) => service.close(resolve)); await rm(directory, { recursive: true, force: true }); });
test("AI cannot select a center or issue a nearby request without explicit user confirmation", async () => {
  const before = requests.length;
  const turn = await submit("unconfirmed", "验收高德附近", "failed");
  assert.match(turn.error, /确认调研中心/); assert.equal(requests.length, before);
  assert.equal((await call("/api/agent/chat")).body.researchLocation, undefined);
});
test("city-limited candidates remain unconfirmed; invalid coordinates, duplicates and secrets are excluded", async () => {
  const turn = await submit("locate", "验收高德定位", "waiting_user");
  places = turn.tools.find((tool) => tool.name === "search_places").output.research.sources;
  assert.equal(places.length, 2); assert.equal(places[0].place.location, "117.2,39.120001");
  assert.equal(places[0].place.cost, undefined); assert.equal(places[0].place.rating, undefined); assert.doesNotMatch(JSON.stringify(places[0]), /53292/);
  assert.equal((await call("/api/agent/chat")).body.researchLocation, undefined);
  assert.equal(requests.at(-1).query.city_limit, "true"); assert.equal(requests.at(-1).query.region, "天津市");
  assert.equal(requests.at(-1).query.page_size, "8"); assert.equal(requests.at(-1).query.page_num, "1");
  assert.doesNotMatch(JSON.stringify(turn), /synthetic-amap-secret|9999/);
  assert.equal(new URL(places[0].url).searchParams.get("coordinate"), "gaode");
});
test("confirmation rejects forged coordinates, unknown source IDs and non-map references", async () => {
  for (const [body, status] of [[{ sourceId: places[0].id, location: "0,0" }, 400], [{ sourceId: "foreign-source" }, 404], [{ sourceId: "" }, 400]]) assert.equal((await call("/api/agent/chat/location", body)).status, status);
  assert.equal((await call("/api/agent/chat")).body.researchLocation, undefined);
});
test("explicit source selection follows the account; duplicate confirmation preserves the saved timestamp", async () => {
  assert.equal((await call("/api/agent/chat/location", { sourceId: places[1].id })).status, 200);
  const first = (await call("/api/agent/chat")).body.researchLocation;
  assert.equal(first.title, "验收广场二店"); assert.equal(first.place.location, "117.21,39.12");
  assert.equal((await call("/api/agent/chat/location", { sourceId: places[1].id })).status, 200);
  assert.deepEqual((await call("/api/agent/chat")).body.researchLocation, first);
});
test("a user cannot switch the center while an active task is using it", async () => {
  const response = await call("/api/agent/chat", { requestId: "busy-center", content: "验收慢任务" });
  assert.equal(response.status, 202);
  assert.equal((await call("/api/agent/chat/location", { sourceId: places[0].id })).status, 409);
  await waitTurn(response.body.turn.id, "completed");
  assert.equal((await call("/api/agent/chat")).body.researchLocation.sourceId, places[1].id);
});
test("nearby queries use the confirmed coordinates and radius, retain unknowns, and exclude out-of-range samples", async () => {
  const turn = await submit("nearby", "验收高德附近", "completed");
  const record = turn.tools.find((tool) => tool.name === "search_nearby_places").output.research;
  assert.equal(requests.at(-1).query.location, "117.21,39.12"); assert.equal(requests.at(-1).query.radius, "3000");
  assert.equal(requests.at(-1).query.sortrule, "weight"); assert.equal(record.sources.length, 3);
  assert.equal(record.sources[0].place.poiId, "B_NEAR"); assert.equal(record.sources[0].place.rating, 4.5);
  assert.equal(record.sources[2].place.rating, undefined); assert.equal(record.sources[2].place.cost, undefined);
  assert.match(record.limitations.join(" "), /不是最近门店全量排名/); assert.doesNotMatch(JSON.stringify(record), /9999/);
});
test("center switching preserves earlier snapshots and blocks model-supplied unconfirmed centers", async () => {
  const before = requests.length;
  const failed = await submit("unselected", `验收高德附近 source=${places[0].id}`, "failed");
  assert.match(failed.error, /确认调研中心/); assert.equal(requests.length, before);
  const old = (await call("/api/agent/chat")).body.turns.find((turn) => turn.requestId === "nearby").tools;
  assert.equal((await call("/api/agent/chat/location", { sourceId: places[0].id })).status, 200);
  const turn = await submit("five-km", "验收高德附近 radius=5000", "completed");
  assert.equal(requests.at(-1).query.radius, "5000"); assert.equal(turn.tools.find((tool) => tool.name === "search_nearby_places").output.research.query.center.sourceId, places[0].id);
  assert.deepEqual((await call("/api/agent/chat")).body.turns.find((turn) => turn.requestId === "nearby").tools, old);
});
test("arbitrary radii never reach the provider", async () => {
  const before = requests.length;
  const turn = await submit("radius", "验收高德附近 radius=50000", "completed");
  assert.equal(turn.tools.some((tool) => tool.name === "search_nearby_places"), false);
  assert.equal(requests.length, before);
});
test("detail IDs come from an owned saved source; phones and competitor photos do not become own materials", async () => {
  const turn = await submit("detail", `验收高德详情 source=${places[0].id}`, "completed");
  const record = turn.tools.find((tool) => tool.name === "read_place").output.research;
  assert.equal(requests.at(-1).path, "/v5/place/detail"); assert.equal(requests.at(-1).query.id, "B_CENTER1");
  assert.equal(record.sources[0].place.cost, 0); assert.doesNotMatch(JSON.stringify(record), /do-not-collect-phone|not-owned-photo/);
  const before = requests.length;
  await submit("bad-detail", "验收高德详情 source=foreign-source", "failed"); assert.equal(requests.length, before);
});
test("an invalid ordinal in an owned record can be corrected without querying the wrong place or deleting its audit", async () => {
  const count = requests.length;
  const turn = await submit("fix-id", `验收高德编号修正 source=${places[0].id}`, "completed");
  const lookups = turn.tools.filter((tool) => tool.name === "read_place");
  assert.equal(lookups[0].status, "failed"); assert.equal(lookups[0].errorStatus, 400);
  assert.equal(lookups[1].status, "succeeded"); assert.equal(lookups[1].input.sourceId, places[0].id);
  assert.equal(requests.length, count + 1); assert.equal(requests.at(-1).query.id, "B_CENTER1");
});
test("legacy rejected references without the new error status resume without migrating or deleting the audit", async () => {
  const count = requests.length;
  const failed = await submit("legacy-id", `验收高德编号修正 验收高德旧编号 source=${places[0].id}`, "failed");
  const file = path.join(directory, "agent-chat.local.json"), store = JSON.parse(await readFile(file));
  const prior = store.turns.find((turn) => turn.id === failed.id).tools.find((tool) => tool.name === "read_place");
  delete prior.errorStatus; prior.legacyField = "preserve";
  await writeFile(file, JSON.stringify(store)); // Isolated synthetic old-version fixture only.
  const before = await readFile(file); await call("/api/agent/chat"); assert.deepEqual(await readFile(file), before);
  assert.equal((await call(`/api/agent/chat/turns/${failed.id}`, { action: "continue" })).status, 200);
  const resumed = await waitTurn(failed.id, "completed");
  assert.equal(resumed.tools.find((tool) => tool.key === prior.key).errorStatus, undefined);
  assert.equal(resumed.tools.find((tool) => tool.key === prior.key).legacyField, "preserve");
  assert.equal(requests.length, count + 1);
});
test("resume corrects a rejected detail but does not repeat the completed one-search web step", async () => {
  const before = requests.length;
  const failed = await submit("place-web-resume", `验收高德网页恢复 source=${places[0].id} 只用一次网页搜索`, "failed");
  const web = failed.tools.find((tool) => tool.name === "search_web");
  assert.equal(requests.length - before, 1);
  assert.equal(failed.tools.find((tool) => tool.name === "read_place").externalAttempts, 0);
  await call(`/api/agent/chat/turns/${failed.id}`, { action: "continue" });
  const resumed = await waitTurn(failed.id, "completed");
  assert.equal(requests.length - before, 2);
  assert.deepEqual(requests.slice(before).map((request) => request.path), ["/res/v1/web/search", "/v5/place/detail"]);
  assert.deepEqual(resumed.tools.find((tool) => tool.name === "search_web"), web);
  assert.equal(resumed.tools.filter((tool) => tool.name === "read_place" && tool.status === "succeeded").length, 1);
});
test("empty success is distinguished from malformed, invalid-coordinate and authorization failures", async () => {
  const empty = await submit("empty", "验收高德定位 query=empty", "waiting_user");
  assert.deepEqual(empty.tools.find((tool) => tool.name === "search_places").output.research.sources, []);
  for (const keyword of ["denied", "httpfail", "malformed", "badcoords"]) {
    const failed = await submit(keyword, `验收高德定位 query=${keyword}`, "failed");
    assert.equal(failed.tools.find((tool) => tool.name === "search_places").output, undefined);
    assert.doesNotMatch(JSON.stringify(failed), /synthetic-amap-secret/);
  }
});
test("successful map queries are checkpointed and not repeated after a model failure", async () => {
  const count = requests.length;
  const turn = await submit("retry", "验收高德定位 验收高德保存后故障", "failed");
  const saved = turn.tools.find((tool) => tool.name === "search_places").output.research;
  assert.equal(requests.length, count + 1);
  assert.equal((await call(`/api/agent/chat/turns/${turn.id}`, { action: "continue" })).status, 200);
  assert.deepEqual((await waitTurn(turn.id, "waiting_user")).tools.find((tool) => tool.name === "search_places").output.research, saved);
  assert.equal(requests.length, count + 1);
});
test("restart restores the selected center; read-only access leaves old data byte-for-byte unchanged", async () => {
  const before = await readFile(path.join(directory, "agent-chat.local.json"));
  const center = (await call("/api/agent/chat")).body.researchLocation;
  await stop(app); app = start(".next/standalone/server.js"); await waitFor(`${base}/api/health`);
  assert.deepEqual((await call("/api/agent/chat")).body.researchLocation, center);
  assert.deepEqual(await readFile(path.join(directory, "agent-chat.local.json")), before);
});
test("missing map configuration is explicit, and existing location history remains usable", async () => {
  const count = requests.length;
  await stop(app); env.AMAP_API_KEY = ""; app = start(".next/standalone/server.js"); await waitFor(`${base}/api/health`);
  const failed = await submit("no-key", "验收高德附近", "failed");
  assert.match(failed.error, /尚未配置/); assert.equal(requests.length, count);
  assert.equal((await call("/api/agent/chat")).body.researchLocation.sourceId, places[0].id);
});
function start(script) { const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] }); children.push(child); child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; }); return child; }
async function stop(child) { if (child.exitCode === null) { const exited = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; } }
async function call(url, body) { const response = await fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; }
async function submit(requestId, content, status) { const response = await call("/api/agent/chat", { requestId, content }); assert.ok([200, 202].includes(response.status), JSON.stringify(response)); return waitTurn(response.body.turn.id, status); }
async function waitTurn(id, status) { for (let i = 0; i < 250; i++) { const turn = (await call("/api/agent/chat")).body.turns.find((item) => item.id === id); if (turn?.status === status) return turn; if (turn?.status === "failed" && status !== "failed") throw new Error(JSON.stringify(turn)); await delay(100); } throw new Error(`Timeout: ${logs.slice(-3000)}`); }
async function waitFor(url) { for (let i = 0; i < 150; i++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); } throw new Error(logs.slice(-3000)); }
