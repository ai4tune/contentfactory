import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.HOME_PLAN_TEST_PORT || 4561);
const base = `http://127.0.0.1:${port}`;
const headers = { authorization: `Basic ${Buffer.from("homeplan:test-code").toString("base64")}`, "content-type": "application/json" };
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (date, days) => { const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); };
let directory, testRoot, logs = "", currentPlan, project;
const children = [];

before(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "contentfactory-home-plan-"));
  directory = path.join(testRoot, "data");
  const guard = path.join(testRoot, "read-guard.mjs");
  await writeFile(guard, `import fs from "node:fs"; import { syncBuiltinESMExports } from "node:module";
const root = process.env.U03_TEST_DATA_ROOT;
for (const name of ["writeFile", "appendFile", "mkdir", "rename", "unlink", "rm"]) {
 const original = fs.promises[name];
 fs.promises[name] = async (...args) => {
  if (fs.existsSync(process.env.U03_TEST_READ_GUARD) && args.some(arg => typeof arg === "string" && arg.startsWith(root))) {
   fs.appendFileSync(process.env.U03_TEST_WRITE_LOG, name + "\\n"); throw Error("Isolated read-only test blocked a data write");
  }
  return original(...args);
 };
}
syncBuiltinESMExports();`);
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|CONTENT_FACTORY|AI_|IMAGE_|VISION_|FEISHU|WORKFLOW_/.test(key)));
  for (const [script, env, args] of [
    ["src/tests/mock-ai-gateway.mjs", { MOCK_AI_PORT: String(port + 1), MOCK_PLAN_DELAY_MS: "400" }, []],
    [".next/standalone/server.js", { HOSTNAME: "127.0.0.1", PORT: String(port), CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_USER: "homeplan", CONTENT_FACTORY_ACCESS_CODE: "test-code", AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock", U03_TEST_DATA_ROOT: directory, U03_TEST_READ_GUARD: path.join(testRoot, "block-writes"), U03_TEST_WRITE_LOG: path.join(testRoot, "writes.log") }, ["--import", guard]],
  ]) {
    const child = spawn(process.execPath, [...args, path.join(root, script)], { cwd: root, env: { ...inherited, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child); child.stdout.on("data", chunk => { logs += chunk; }); child.stderr.on("data", chunk => { logs += chunk; });
    await waitFor(script.startsWith("src") ? `http://127.0.0.1:${port + 1}/health` : base + "/api/health");
  }
  const answers = { accountName: "本地任务验证店", business: "花艺制作与到店服务", primaryChannel: "wechat_article", goal: "介绍服务", offer: "花艺服务" };
  const preview = await call("/api/onboarding/interview", { action: "preview", revision: 0, answers });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  const state = preview.body.interview;
  const confirmed = await call("/api/onboarding/interview", { action: "confirm", revision: state.revision, previewId: state.preview.id, edits: { accountPosition: "介绍真实花艺服务", targetAudience: ["对花艺服务感兴趣的人"], contentPillars: ["服务介绍", "店铺日常", "到店场景"] } });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
});
after(async () => {
  for (const child of children.reverse()) if (child.exitCode === null) { const exited = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; }
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
});

test("the home works without a plan and continues the actual saved first draft", async () => {
  const before = await files();
  assert.match(await page("/"), /暂未制定计划/);
  assert.match(await page("/plans"), /7 天，先跑一轮/);
  assert.deepEqual(await files(), before);
  const generated = await call("/api/onboarding/first-content", { action: "generate", topic: "介绍花艺服务", channel: "wechat_article", version: 0, useDefaultStyle: true });
  assert.equal(generated.status, 200, JSON.stringify(generated.body)); project = generated.body.project;
  const html = await page("/"); assert.match(html, /已生成，待人工审核/); assert.ok(html.includes(`/drafts/${project.id}`));
  const approved = await call(`/api/content-drafts/${project.id}`, { reviewStatus: "approved" }, "PATCH");
  assert.equal(approved.status, 200); assert.match(await page("/"), /已审核，待发布/);
});
test("short and month plans persist real dates at selected frequency", async () => {
  const short = await call("/api/content-plans", { periodDays: 7, publishingFrequency: 1, periodStart: today, timeZone: "Asia/Shanghai" });
  assert.equal(short.status, 201, JSON.stringify(short.body)); assert.equal(short.body.plan.items.length, 1); assert.equal(short.body.plan.periodEnd, addDays(today, 6));
  const low = await call("/api/content-plans", { periodDays: 30, publishingFrequency: 1, periodStart: today });
  assert.equal(low.status, 201); assert.equal(low.body.plan.items.length, 5);
  const high = await call("/api/content-plans", { periodDays: 30, publishingFrequency: 3, periodStart: today });
  assert.equal(high.status, 201); currentPlan = high.body.plan; assert.equal(currentPlan.items.length, 13);
  assert.ok(currentPlan.items.every(item => item.scheduledDate >= today && item.scheduledDate <= currentPlan.periodEnd));
  assert.equal(currentPlan.items.filter(item => item.week === 5).length, 1);
  assert.equal((await call(`/api/content-plans/${short.body.plan.id}`)).body.plan.items.length, 1);
  assert.match(await page(`/plans?planId=${short.body.plan.id}`), /历史计划/);
  for (const body of [{ periodDays: 8 }, { publishingFrequency: 0 }, { timeZone: "invalid" }]) assert.equal((await call("/api/content-plans", body)).status, 400);
  currentPlan = (await call(`/api/content-plans/${currentPlan.id}`, { status: "confirmed" }, "PATCH")).body.plan;
});
test("photos and research are real tasks, while paused or non-content tasks cannot generate articles", async () => {
  const added = await call(`/api/content-plans/${currentPlan.id}/items`, { taskType: "photos", title: "拍门头和服务细节", scheduledDate: today });
  assert.equal(added.status, 201); currentPlan = added.body.plan;
  const photos = currentPlan.items.at(-1);
  assert.match(await page("/"), /拍门头和服务细节/);
  assert.equal((await call(`/api/content-plans/${currentPlan.id}/items/${photos.id}`, { status: "completed" }, "PATCH")).status, 200);
  assert.equal((await call(`/api/content-plans/${currentPlan.id}/items/${photos.id}`, { status: "published" }, "PATCH")).status, 400);
  const item = currentPlan.items[0];
  assert.equal((await call(`/api/content-plans/${currentPlan.id}/items/${item.id}`, { status: "completed" }, "PATCH")).status, 400);
  assert.equal((await call(`/api/content-plans/${currentPlan.id}/items/${item.id}`, { status: "paused" }, "PATCH")).status, 200);
  for (const id of [photos.id, item.id]) assert.equal((await call("/api/content/quick/knowledge", { contentPlanId: currentPlan.id, contentPlanItemId: id })).status, 409);
  assert.equal((await call(`/api/content-plans/${currentPlan.id}/items/${item.id}`, { status: "pending" }, "PATCH")).status, 200);
});
test("regeneration preserves past dates, started/published/locked work and unknown fields", async () => {
  const file = path.join(directory, "content-plans.local.json");
  const store = JSON.parse(await readFile(file, "utf8"));
  const fixture = store.plans.find(plan => plan.id === currentPlan.id);
  fixture.items[0] = { ...fixture.items[0], status: "published", publicationId: "synthetic-publication", unknownLegacy: { owner: "isolated" } };
  fixture.items[1] = { ...fixture.items[1], status: "writing", contentProjectId: project.id };
  fixture.items[2] = { ...fixture.items[2], title: "人工确认保留的选题", locked: true };
  fixture.items[3] = { ...fixture.items[3], scheduledDate: addDays(today, -1) };
  store.unknownStoreField = "preserve";
  await writeFile(file, JSON.stringify(store));
  const protectedItems = [...fixture.items.slice(0, 4), fixture.items.at(-1)];
  const result = await call(`/api/content-plans/${currentPlan.id}/generate`, { contextEvidence: [] });
  assert.equal(result.status, 200, JSON.stringify(result.body)); currentPlan = result.body.plan;
  for (const item of protectedItems) assert.deepEqual(currentPlan.items.find(candidate => candidate.id === item.id), item);
  assert.equal(JSON.parse(await readFile(file, "utf8")).unknownStoreField, "preserve");
  assert.ok(currentPlan.items.filter(item => !protectedItems.some(saved => saved.id === item.id)).every(item => item.scheduledDate >= today));
});
test("a user edit during AI generation is retained and the stale result is rejected", async () => {
  const pending = currentPlan.items.find(item => item.status === "pending" && !item.locked);
  assert.ok(pending);
  const generating = call(`/api/content-plans/${currentPlan.id}/generate`, { contextEvidence: [] });
  await delay(150);
  const changed = await call(`/api/content-plans/${currentPlan.id}/items/${pending.id}`, { title: "生成期间用户保存的新安排" }, "PATCH");
  assert.equal(changed.status, 200);
  const result = await generating; assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal((await call(`/api/content-plans/${currentPlan.id}`)).body.plan.items.find(item => item.id === pending.id).title, "生成期间用户保存的新安排");
});
test("legacy plans, drafts, versions and ownership stay readable with writes blocked and byte snapshots unchanged", async () => {
  const file = path.join(directory, "content-plans.local.json");
  const store = JSON.parse(await readFile(file, "utf8"));
  const source = store.plans.find(plan => plan.id === currentPlan.id);
  const legacy = { ...source, id: "legacy-plan", title: "旧版无日期计划", status: "archived", periodStart: "2026-08-01", periodEnd: "2026-08-30", updatedAt: "2026-08-01T00:00:00Z", unknownOwnership: "old-owner", items: source.items.slice(0, 2).map(item => { const rest = { ...item }; delete rest.scheduledDate; delete rest.taskType; return rest; }) };
  delete legacy.timeZone; store.plans.push(legacy); await writeFile(file, JSON.stringify(store));
  const before = await files(); await writeFile(path.join(testRoot, "block-writes"), "blocked");
  for (const url of ["/", "/plans", "/plans?planId=legacy-plan", "/articles", `/drafts/${project.id}`, "/brand"]) assert.equal((await fetch(base + url, { headers })).status, 200, url);
  assert.equal((await call("/api/content-plans/legacy-plan")).body.plan.unknownOwnership, "old-owner");
  assert.deepEqual((await call("/api/content-plans/legacy-plan")).body.plan, legacy);
  assert.deepEqual(await files(), before);
  assert.equal(await readFile(path.join(testRoot, "writes.log"), "utf8").catch(() => ""), "", "zero write attempts during reads");
  assert.equal((await fetch(base + `/api/content-plans/${currentPlan.id}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskType: "photos", title: "forged", scheduledDate: today }) })).status, 401);
  assert.equal((await call("/api/content-plans/another-account-id/items", { taskType: "photos", title: "forged", scheduledDate: today })).status, 404);
  assert.deepEqual(await files(), before);
});
async function call(url, body, method = body === undefined ? "GET" : "POST") { const response = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; }
async function page(url) { const response = await fetch(base + url, { headers }); assert.equal(response.status, 200, url); return response.text(); }
async function files() { return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async name => [name, (await readFile(path.join(directory, name))).toString("base64")]))); }
async function waitFor(url) { for (let index = 0; index < 150; index++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); } throw Error(logs); }
