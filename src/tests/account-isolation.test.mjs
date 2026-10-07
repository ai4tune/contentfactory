import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.ACCOUNT_ISOLATION_TEST_PORT || 4359);
const base = `http://127.0.0.1:${port}`;
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const shared = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
const outsider = "44444444-4444-4444-8444-444444444444";
function privateWorkspace(userId) {
  const hex = createHash("sha256").update(`${shared}:${userId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const aliceWorkspace = privateWorkspace(alice), bobWorkspace = privateWorkspace(bob);
const users = new Map([alice, bob, outsider].map((id, index) => [id, { id, email: `user${index}@example.com`, aud: "authenticated", role: "authenticated" }]));
const rows = {
  content_factory_workspaces: [{ id: shared, name: "Legacy shared" }],
  content_factory_workspace_members: [alice, bob].map((id) => ({ workspace_id: shared, user_id: id, role: "member" })),
  content_factory_state: [{ workspace_id: shared, store_key: "json:contentfactory.local.json", version: 1, payload: { accountContext: { accountName: "混合旧定位" } } }],
};
let app, service, directory, logs = "";

function jwt(id) {
  return [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: id, exp: expiresAt })).toString("base64url"), "synthetic-signature"].join(".");
}
function cookie(id) {
  const session = { access_token: jwt(id), refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: users.get(id) };
  return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}
async function request(id, url, body, method = body === undefined ? "GET" : "POST", extra = {}) {
  return fetch(`${base}${url}`, { method, headers: { ...(id ? { Cookie: cookie(id) } : {}), "Content-Type": "application/json", ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function respond(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "account-isolation-"));
  service = createServer(async (request, response) => {
    const url = new URL(request.url, "http://local");
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : undefined;
    if (url.pathname === "/auth/v1/user") {
      const token = request.headers.authorization?.slice(7);
      const id = [...users.keys()].find((key) => token === jwt(key));
      return respond(response, id ? 200 : 401, id ? users.get(id) : { msg: "Invalid token" });
    }
    if (url.pathname === "/v1/chat/completions") {
      await delay(500);
      const organization = body.messages[0].content.includes("summary 和 assignments");
      const result = organization ? { summary: "独立整理", assignments: [{ sourceId: "private-source", folderId: "brand", reason: "资料" }] }
        : { name: "私有档案", businessSummary: "私人业务", targetCustomers: [], offers: [], strengths: [], businessGoals: [], preferredTopics: [], forbiddenClaims: [], gaps: [], facts: [{ category: "业务", statement: "账号资料", confidence: "confirmed", sourceIds: ["private-source"] }] };
      return respond(response, 200, { choices: [{ message: { content: JSON.stringify(result) } }] });
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (!rows[table]) return respond(response, 404, { message: "Unknown table" });
    const filters = [...url.searchParams].filter(([, value]) => value.startsWith("eq."));
    const matches = (row) => filters.every(([key, value]) => String(row[key]) === value.slice(3));
    if (request.method === "GET") return respond(response, 200, rows[table].filter(matches));
    if (request.method === "POST") {
      const keys = table === "content_factory_state" ? ["workspace_id", "store_key"] : table === "content_factory_workspace_members" ? ["workspace_id", "user_id"] : ["id"];
      const existing = rows[table].find((row) => keys.every((key) => row[key] === body[key]));
      if (existing && !request.headers.prefer?.includes("resolution=ignore-duplicates")) return respond(response, 409, { code: "23505", message: "Duplicate" });
      if (!existing) rows[table].push(body);
      return respond(response, 201, null);
    }
    if (request.method === "PATCH") {
      const found = rows[table].filter(matches);
      found.forEach((row) => Object.assign(row, body));
      return respond(response, 200, found);
    }
    respond(response, 405, {});
  });
  await new Promise((resolve) => service.listen(0, "127.0.0.1", resolve));
  const serviceUrl = `http://127.0.0.1:${service.address().port}`;
  app = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env: {
    ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port),
    NEXT_PUBLIC_SUPABASE_URL: serviceUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", SUPABASE_SECRET_KEY: "sb_secret_synthetic", CONTENT_FACTORY_WORKSPACE_ID: shared,
    CONTENT_FACTORY_CAPTURE_TOKEN: "synthetic-capture-signing-key", CONTENT_FACTORY_DATA_DIR: directory,
    AI_BASE_URL: `${serviceUrl}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "synthetic",
    WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: base,
  }, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", (chunk) => { logs += chunk; });
  app.stderr.on("data", (chunk) => { logs += chunk; });
  for (let index = 0; index < 100; index++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* Server starting. */ }
    await delay(200);
  }
  throw new Error(logs);
});

after(async () => {
  if (app?.exitCode === null) { const stopped = new Promise((resolve) => app.once("exit", resolve)); app.kill("SIGTERM"); await stopped; }
  service?.closeAllConnections();
  await new Promise((resolve) => service?.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

const draft = (name) => ({ source: "manual", input: { accountName: name, business: name, offer: "分享", platforms: "公众号" }, accountName: name, business: name, offer: "分享", accountPosition: name, platforms: ["公众号"], targetAudience: ["读者"], contentPillars: [], brandVoice: [], preferredPhrases: [], bannedPhrases: [], contentDirections: [], recommendedTopics: [], analysisEvidence: [], informationGaps: [], conversionGoal: "关注" });

test("login identity controls every cloud store, regardless of shared invitation membership", async () => {
  assert.equal((await request(null, "/api/positioning/current")).status, 401);
  assert.equal((await request(outsider, "/api/auth/session")).status, 403);
  const initial = await request(alice, "/api/positioning/current");
  assert.equal(initial.status, 200, await initial.clone().text());
  assert.equal((await initial.json()).context, null, "legacy mixed state must never be inherited");
  const results = await Promise.all([request(alice, "/api/positioning/current", { action: "confirm", draft: draft("闲中记") }, "PATCH"), request(bob, "/api/positioning/current", { action: "confirm", draft: draft("杏仁AI掘金社") }, "PATCH")]);
  for (const result of results) assert.equal(result.status, 200, await result.clone().text());
  for (let index = 0; index < 3; index++) {
    assert.equal((await (await request(alice, "/api/positioning/current")).json()).context.accountName, "闲中记");
    assert.equal((await (await request(bob, "/api/positioning/current")).json()).context.accountName, "杏仁AI掘金社");
  }
  await request(bob, "/api/positioning/current", { action: "confirm", draft: draft("杏仁新定位") }, "PATCH", { "x-workspace-id": alice });
  assert.equal((await (await request(alice, "/api/positioning/current")).json()).context.accountName, "闲中记");
  assert.equal((await (await request(bob, "/api/auth/session")).json()).workspaceId, bobWorkspace);
  assert.equal(rows.content_factory_state.find((row) => row.workspace_id === shared).payload.accountContext.accountName, "混合旧定位");
});

test("capture tokens are account-specific and reject the legacy global token and forged identity", async () => {
  const token = (await (await request(alice, "/api/capture/authorize", {})).json()).token;
  assert.ok(token.startsWith(`cf1.${aliceWorkspace}.`));
  const validStatus = await request(alice, "/api/capture/status", { token });
  assert.equal(validStatus.status, 200);
  assert.equal(validStatus.headers.get("cache-control"), "no-store");
  assert.equal((await validStatus.json()).authorized, true);
  assert.equal((await (await request(bob, "/api/capture/status", { token })).json()).authorized, false, "website must reject authorization for another login account");
  assert.equal((await request(null, "/api/capture/status", { token })).status, 401);
  const expiredPayload = `cf1.${aliceWorkspace}.1`;
  const expired = `${expiredPayload}.${createHmac("sha256", "sb_secret_synthetic").update(expiredPayload).digest("base64url")}`;
  for (const invalid of ["synthetic-capture-signing-key", expired, token.replace(aliceWorkspace, bobWorkspace)]) {
    assert.equal((await (await request(alice, "/api/capture/status", { token: invalid })).json()).authorized, false);
  }
  assert.notEqual(token, (await (await request(bob, "/api/capture/authorize", {})).json()).token);
  const payload = { action: "confirm", draft: draft("闲中记采集定位") };
  const captured = await request(null, "/api/capture/account", payload, "POST", { Authorization: `Bearer ${token}` });
  assert.equal(captured.status, 200, await captured.clone().text());
  assert.equal((await (await request(alice, "/api/positioning/current")).json()).context.accountName, "闲中记采集定位");
  assert.equal((await (await request(bob, "/api/positioning/current")).json()).context.accountName, "杏仁新定位");
  const forgedPayload = `cf1.${bobWorkspace}.${expiresAt}`;
  const forgedWithLegacySecret = `${forgedPayload}.${createHmac("sha256", "synthetic-capture-signing-key").update(forgedPayload).digest("base64url")}`;
  for (const invalid of ["synthetic-capture-signing-key", token.replace(aliceWorkspace, bobWorkspace), forgedWithLegacySecret]) {
    assert.equal((await request(null, "/api/capture/account", payload, "POST", { Authorization: `Bearer ${invalid}` })).status, 403);
  }
  const otherDeployment = "55555555-5555-4555-8555-555555555555";
  rows.content_factory_workspace_members.push({ workspace_id: otherDeployment, user_id: alice, role: "owner" });
  const otherPayload = `cf1.${otherDeployment}.${expiresAt}`;
  const otherToken = `${otherPayload}.${createHmac("sha256", "sb_secret_synthetic").update(otherPayload).digest("base64url")}`;
  assert.equal((await request(null, "/api/capture/account", payload, "POST", { Authorization: `Bearer ${otherToken}` })).status, 403, "a valid token for another deployment cannot choose its workspace here");
  rows.content_factory_workspace_members = rows.content_factory_workspace_members.filter((row) => !(row.workspace_id === shared && row.user_id === alice));
  assert.equal((await request(alice, "/api/capture/status", { token })).status, 403);
  assert.equal((await request(null, "/api/capture/account", payload, "POST", { Authorization: `Bearer ${token}` })).status, 403);
  rows.content_factory_workspace_members.push({ workspace_id: shared, user_id: alice, role: "member" });
});

test("private content and materials cannot be fetched by another account even with a known record ID", async () => {
  const created = await request(alice, "/api/content/projects", { topic: "私有草稿", brief: { targetAudience: "读者", contentGoal: "分享", coreMessage: "历史人文", keyPoints: [], outline: ["开头"], citations: [{ sourceId: "private", sourceTitle: "私有资料", sourceType: "upload", excerpt: "历史", purpose: "证据" }], openQuestions: [] } });
  assert.equal(created.status, 201, await created.clone().text());
  const projectId = (await created.json()).project.id;
  assert.equal((await request(alice, `/api/content-drafts/${projectId}`)).status, 200);
  assert.equal((await request(bob, `/api/content-drafts/${projectId}`)).status, 404);
  assert.equal((await request(bob, `/api/content-drafts/${projectId}`, { reviewStatus: "approved" }, "PATCH")).status, 404);
  const current = rows.content_factory_state.find((row) => row.workspace_id === aliceWorkspace && row.store_key === "json:contentfactory.local.json");
  current.payload.materials = [{ id: "private-material", title: "私有资料", content: "不共享", source: "upload" }];
  assert.equal((await (await request(alice, "/api/materials")).json()).materials.length, 1);
  assert.deepEqual((await (await request(bob, "/api/materials")).json()).materials, []);
});

test("background jobs retain the submitting account after the browser switches identity", { timeout: 45_000 }, async () => {
  const sources = [{ id: "private-source", title: "私有资料", text: "私人业务", source: "upload" }];
  const submitted = await request(alice, "/api/knowledge/tasks", { kind: "profile", sources });
  assert.equal(submitted.status, 202, await submitted.clone().text());
  const id = (await submitted.json()).task.id;
  assert.deepEqual((await (await request(bob, "/api/knowledge/tasks")).json()).tasks, []);
  assert.equal((await request(bob, `/api/knowledge/tasks/${id}/retry`, {})).status, 404);
  // A second account can submit simultaneously: no shared active-job lock.
  assert.equal((await request(bob, "/api/knowledge/tasks", { kind: "organization", sources })).status, 202);
  await delay(2000);
  const deadline = Date.now() + 25_000;
  let finished;
  while (Date.now() < deadline) {
    finished = (await (await request(alice, "/api/knowledge/tasks")).json()).tasks.find((task) => task.id === id);
    if (finished?.status === "succeeded") break;
    await delay(250);
  }
  assert.equal(finished?.status, "succeeded", JSON.stringify(finished) + logs.slice(-4000));
  assert.ok(rows.content_factory_state.find((row) => row.workspace_id === aliceWorkspace && row.store_key === "json:enterprise-knowledge-profiles.local.json"));
  assert.equal(rows.content_factory_state.some((row) => row.workspace_id === bobWorkspace && row.store_key === "json:enterprise-knowledge-profiles.local.json"), false);
  assert.equal(rows.content_factory_state.some((row) => row.workspace_id === shared && row.store_key === "json:knowledge-tasks.local.json"), false);
});
