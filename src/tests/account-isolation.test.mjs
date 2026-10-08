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
const owner = "66666666-6666-4666-8666-666666666666";
function privateWorkspace(userId) {
  const hex = createHash("sha256").update(`${shared}:${userId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const aliceWorkspace = privateWorkspace(alice), bobWorkspace = privateWorkspace(bob);
const users = new Map([alice, bob, outsider].map((id, index) => [id, { id, email: `user${index}@example.com`, aud: "authenticated", role: "authenticated" }]));
users.set(owner, { id: owner, email: "owner@example.com", email_confirmed_at: "2026-10-01T00:00:00Z", aud: "authenticated", role: "authenticated" });
const rows = {
  content_factory_workspaces: [{ id: shared, name: "Legacy shared" }],
  content_factory_workspace_members: [alice, bob].map((id) => ({ workspace_id: shared, user_id: id, role: "member" })),
  content_factory_state: [{ workspace_id: shared, store_key: "json:contentfactory.local.json", version: 1, payload: { accountContext: { accountName: "混合旧定位" } } }],
};
let app, service, directory, logs = "";
let readOnlyGuard = false, blockedMutations = 0;
let failInvitation = false, failGrant = false;
const invitations = [];
const stateReads = [];

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
  response.writeHead(status, { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" });
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
    if (url.pathname === "/auth/v1/invite") {
      if (failInvitation) return respond(response, 429, { code: "over_email_send_rate_limit", msg: "Rate limited" });
      let user = [...users.values()].find((candidate) => candidate.email === body.email);
      if (user?.email_confirmed_at) return respond(response, 422, { code: "email_exists", msg: "Registered" });
      if (!user) {
        user = { id: crypto.randomUUID(), email: body.email, aud: "authenticated", role: "authenticated", invited_at: new Date().toISOString() };
        users.set(user.id, user);
      }
      invitations.push({ email: body.email, redirectTo: url.searchParams.get("redirect_to") });
      return respond(response, 200, user);
    }
    if (url.pathname === "/auth/v1/admin/users") return respond(response, 200, { users: [...users.values()], aud: "authenticated" });
    if (url.pathname === "/v1/chat/completions") {
      await delay(500);
      const organization = body.messages[0].content.includes("summary 和 assignments");
      const result = organization ? { summary: "独立整理", assignments: [{ sourceId: "private-source", folderId: "brand", reason: "资料" }] }
        : { name: "私有档案", businessSummary: "私人业务", targetCustomers: [], offers: [], strengths: [], businessGoals: [], preferredTopics: [], forbiddenClaims: [], gaps: [], facts: [{ category: "业务", statement: "账号资料", confidence: "confirmed", sourceIds: ["private-source"] }] };
      return respond(response, 200, { choices: [{ message: { content: JSON.stringify(result) } }] });
    }
    if (readOnlyGuard && request.method !== "GET") {
      blockedMutations++;
      return respond(response, 500, { message: "Existing customer data is read-only during upgrade acceptance" });
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (!rows[table]) return respond(response, 404, { message: "Unknown table" });
    const filters = [...url.searchParams].filter(([, value]) => value.startsWith("eq."));
    const matches = (row) => filters.every(([key, value]) => String(row[key]) === value.slice(3));
    if (request.method === "GET") {
      if (table === "content_factory_state") stateReads.push(Object.fromEntries(filters));
      return respond(response, 200, rows[table].filter(matches));
    }
    if (request.method === "POST") {
      if (failGrant && table === "content_factory_workspace_members") return respond(response, 500, { message: "Synthetic permission failure" });
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
  await new Promise((resolve) => service.listen(Number(process.env.ACCOUNT_ISOLATION_SERVICE_PORT || 0), "127.0.0.1", resolve));
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

test("interview answers survive in the owner's cloud space without leaking to another login", async () => {
  assert.equal((await request(null, "/api/onboarding/interview")).status, 401);
  const initial = (await (await request(alice, "/api/onboarding/interview")).json()).interview;
  const saved = await request(alice, "/api/onboarding/interview", {
    action: "save", revision: initial.revision, step: 1,
    answers: { ...initial.answers, accountName: "闲中记访谈", business: "账号私有的经营回答" },
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  const restored = (await (await request(alice, "/api/onboarding/interview")).json()).interview;
  assert.equal(restored.answers.business, "账号私有的经营回答");
  const other = (await (await request(bob, "/api/onboarding/interview")).json()).interview;
  assert.equal(other.revision, 0);
  assert.notEqual(other.answers.business, restored.answers.business);
  assert.equal(rows.content_factory_state.find((row) => row.workspace_id === aliceWorkspace && row.store_key === "json:onboarding-interview.local.json").payload.answers.business, restored.answers.business);
});

test("industry starter drafts and confirmed preferences remain private to each login", async () => {
  const a = (await (await request(alice, "/api/onboarding/first-content")).json());
  const b = (await (await request(bob, "/api/onboarding/first-content")).json());
  let coffee = await request(alice, "/api/onboarding/first-content", { action: "preview_style", industry: "coffee", voice: "chat", adjustments: "Alice-private-preference", version: a.profileVersion });
  let flooring = await request(bob, "/api/onboarding/first-content", { action: "preview_style", industry: "flooring", voice: "professional", adjustments: "Bob-private-preference", version: b.profileVersion });
  assert.equal(coffee.status, 200, await coffee.clone().text()); assert.equal(flooring.status, 200, await flooring.clone().text());
  coffee = (await coffee.json()).profile; flooring = (await flooring.json()).profile;
  assert.equal((await (await request(alice, "/api/onboarding/first-content")).json()).confirmedProfile, null);
  coffee = (await (await request(alice, "/api/onboarding/first-content", { action: "confirm_style", version: coffee.version })).json()).profile;
  flooring = (await (await request(bob, "/api/onboarding/first-content", { action: "confirm_style", version: flooring.version })).json()).profile;
  assert.equal(coffee.starterTemplate.industry, "coffee"); assert.equal(flooring.starterTemplate.industry, "flooring");
  const own = await (await request(alice, "/api/onboarding/first-content", undefined, "GET", { "x-workspace-id": bobWorkspace })).json();
  const other = await (await request(bob, "/api/onboarding/first-content")).json();
  assert.match(JSON.stringify(own), /Alice-private-preference/); assert.doesNotMatch(JSON.stringify(own), /Bob-private-preference/);
  assert.match(JSON.stringify(other), /Bob-private-preference/); assert.doesNotMatch(JSON.stringify(other), /Alice-private-preference/);
  const changed = await request(alice, "/api/onboarding/first-content", { action: "preview_style", industry: "flooring", voice: "lifestyle", adjustments: "", version: own.profileVersion });
  assert.equal(changed.status, 200);
  assert.equal((await (await request(alice, "/api/onboarding/first-content")).json()).confirmedProfile.starterTemplate.industry, "coffee");
  assert.equal((await (await request(bob, "/api/onboarding/first-content")).json()).confirmedProfile.version, flooring.version);
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


test("existing v1 customer spaces load through the upgrade without any write or payload change", async () => {
  for (const id of [alice, bob]) {
    for (let index = 0; index < 40; index++) {
      const tasks = (await (await request(id, "/api/knowledge/tasks")).json()).tasks;
      if (tasks.every((task) => ["succeeded", "failed"].includes(task.status))) break;
      if (index === 39) throw new Error("Background test jobs did not settle");
      await delay(100);
    }
  }
  const originalProfiles = new Map();
  for (const workspace of [aliceWorkspace, bobWorkspace]) {
    const row = rows.content_factory_state.find((item) => item.workspace_id === workspace && item.store_key === "json:style-profiles.local.json");
    for (const profile of [row.payload.confirmedProfile, row.payload.draftProfile]) if (profile) {
      profile.starterTemplate.version = 1;
      profile.customerOwnedField = "preserve unknown legacy fields";
    }
    originalProfiles.set(workspace, structuredClone(row.payload));
    rows.content_factory_state.push({ workspace_id: workspace, store_key: "json:future-customer-data.local.json", version: 19, payload: { keep: ["private", "untouched"], updatedAt: "2026-10-01T10:00:00Z" } });
  }
  const before = structuredClone(rows);
  readOnlyGuard = true;
  try {
    for (const [id, workspace] of [[alice, aliceWorkspace], [bob, bobWorkspace]]) {
      for (const url of ["/api/onboarding/first-content", "/api/onboarding/first-content?industry=coffee", "/api/onboarding/first-content?industry=flooring", "/api/onboarding/interview", "/api/positioning/current", "/api/style-profile/current", "/api/content-drafts", "/api/materials", "/setup/first-content", "/setup/interview", "/brand", "/brand?step=positioning", "/brand?step=style", "/style-profile", "/knowledge/profile"]) {
        const response = await request(id, url);
        assert.equal(response.status, 200, url + " " + await response.clone().text());
        if (url === "/api/onboarding/first-content") {
          const snapshot = await response.json();
          assert.deepEqual(snapshot.confirmedProfile, originalProfiles.get(workspace).confirmedProfile);
          assert.deepEqual(snapshot.draftProfile, originalProfiles.get(workspace).draftProfile ?? null);
          const comparison = await request(id, "/api/onboarding/first-content", { action: "compare_style", voice: "chat", adjustments: "", version: snapshot.profileVersion });
          assert.equal(comparison.status, 200);
          const candidate = (await comparison.json()).profile;
          assert.ok(JSON.stringify(candidate).includes(id === alice ? "Alice-private-preference" : "Bob-private-preference"));
          assert.deepEqual(candidate.customerOwnedField, "preserve unknown legacy fields");
        }
      }
    }
    assert.equal(blockedMutations, 0, "opening upgraded pages must not attempt cloud mutations");
    assert.deepEqual(rows, before, "all payloads, versions, membership rows and timestamps must remain exactly unchanged");
  } finally { readOnlyGuard = false; }
});

test("page reads are deduplicated per request and remain fresh and private on later requests", async () => {
  stateReads.length = 0;
  assert.equal((await request(alice, "/brand")).status, 200);
  const keys = stateReads.map((read) => `${read.workspace_id}:${read.store_key}`);
  assert.equal(new Set(keys).size, keys.length, "one render should only read each account store once");
  assert.ok(keys.some((key) => key.endsWith("json:contentfactory.local.json")));
  stateReads.length = 0;
  assert.equal((await request(bob, "/brand")).status, 200);
  assert.ok(stateReads.length > 0);
  assert.ok(stateReads.every((read) => read.workspace_id === `eq.${bobWorkspace}`));
  stateReads.length = 0;
  assert.equal((await request(alice, "/brand")).status, 200);
  assert.ok(stateReads.length > 0, "another request must fetch fresh data");
});

test("only deployment owners can invite; invalid input and cross-origin requests send no mail", async () => {
  rows.content_factory_workspace_members.push({ workspace_id: shared, user_id: owner, role: "owner" });
  const before = structuredClone(rows);
  const sent = invitations.length;
  assert.equal((await request(null, "/api/operations/invitations", { email: "new@example.com" })).status, 401);
  assert.equal((await request(alice, "/api/operations/invitations", { email: "new@example.com", role: "owner" })).status, 403);
  assert.equal((await request(owner, "/api/operations/invitations", { email: "invalid" })).status, 400);
  assert.equal((await request(owner, "/api/operations/invitations", { email: "new@example.com" }, "POST", { Origin: "https://other.example" })).status, 403);
  assert.equal(invitations.length, sent);
  assert.deepEqual(rows, before);
  assert.equal((await request(alice, "/operations/invitations", undefined, "GET", { "x-test": "member" })).url.endsWith("/access-denied"), true);
  assert.equal((await request(owner, "/operations/invitations")).status, 200);
});

test("one invitation both sends mail and grants only member access without touching existing spaces", async () => {
  const before = structuredClone(rows);
  const response = await request(owner, "/api/operations/invitations", { email: " New@Example.com ", role: "owner", workspaceId: bobWorkspace }, "POST", { Origin: base });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.email, "new@example.com"); assert.equal(result.emailSent, true); assert.equal(result.role, "member");
  const user = [...users.values()].find((candidate) => candidate.email === result.email);
  assert.deepEqual(invitations.at(-1), { email: result.email, redirectTo: `${base}/auth/confirm?next=/set-password` });
  assert.deepEqual(rows.content_factory_workspace_members.at(-1), { workspace_id: shared, user_id: user.id, role: "member" });
  assert.deepEqual({ ...rows, content_factory_workspace_members: rows.content_factory_workspace_members.slice(0, -1) }, before);
  assert.equal((await request(user.id, "/api/positioning/current")).status, 200);
  assert.equal((await request(user.id, "/api/operations/invitations", { email: "another@example.com" })).status, 403);
});

test("mail failures grant no access and permission failures remain retryable after confirmation", async () => {
  const before = structuredClone(rows);
  failInvitation = true;
  try { assert.equal((await request(owner, "/api/operations/invitations", { email: "limited@example.com" })).status, 429); }
  finally { failInvitation = false; }
  assert.deepEqual(rows, before);
  failGrant = true;
  try {
    const response = await request(owner, "/api/operations/invitations", { email: "retry@example.com" });
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.emailSent, true); assert.match(result.error, /权限开通失败/);
  } finally { failGrant = false; }
  assert.deepEqual(rows, before);
  const user = [...users.values()].find((candidate) => candidate.email === "retry@example.com");
  user.email_confirmed_at = "2026-10-08T00:00:00Z";
  const sent = invitations.length;
  const response = await request(owner, "/api/operations/invitations", { email: user.email });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).emailSent, false);
  assert.equal(invitations.length, sent);
  assert.equal((await request(user.id, "/api/positioning/current")).status, 200);
});

test("repeated invitations preserve existing owner roles, private data and timestamps", async () => {
  const before = structuredClone(rows);
  const response = await request(owner, "/api/operations/invitations", { email: "owner@example.com" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.emailSent, false); assert.equal(result.role, "owner");
  assert.deepEqual(rows, before);
});
