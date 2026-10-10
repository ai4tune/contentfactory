import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.FIRST_CONTENT_START_TEST_PORT || 4417);
const base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("starter:test-code").toString("base64")}`;
const children = [];
let directory, logs = "", state;
const answers = { accountName: "晨光花艺", business: "制作鲜花花束，提供花艺服务", primaryChannel: "xiaohongshu_note" };

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "contentfactory-first-start-"));
  for (const [script, env] of [
    ["src/tests/mock-ai-gateway.mjs", { MOCK_AI_PORT: String(port + 1) }],
    [".next/standalone/server.js", {
      HOSTNAME: "127.0.0.1", PORT: String(port), CONTENT_FACTORY_DATA_DIR: directory,
      CONTENT_FACTORY_ACCESS_USER: "starter", CONTENT_FACTORY_ACCESS_CODE: "test-code",
      AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock",
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CONTENT_FACTORY_WORKSPACE_ID: "",
    }],
  ]) {
    const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; });
    await waitFor(script.startsWith("src") ? `http://127.0.0.1:${port + 1}/health` : `${base}/api/health`);
  }
});

after(async () => {
  for (const child of children.reverse()) {
    if (child.exitCode === null) { const exited = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; }
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("first-use entry is read-only and offers creation without a full interview", async () => {
  assert.equal((await fetch(base + "/api/onboarding/interview")).status, 401);
  const before = await files();
  for (const url of ["/setup", "/setup/first-content", "/api/onboarding/status", "/api/onboarding/interview"]) {
    const response = await fetch(base + url, { headers: { authorization } });
    assert.equal(response.status, 200, url);
    const text = await response.text();
    if (url === "/setup") assert.match(text, /先写一篇/);
    if (url === "/setup/first-content") assert.match(text, /确认业务，开始写/);
  }
  assert.deepEqual(await files(), before, "opening first-use pages must not create or change data");
  assert.equal((await call("/api/onboarding/interview", { action: "confirm_business", revision: 0, answers: { business: [] } })).status, 400);
  assert.equal((await call("/api/onboarding/interview", { action: "confirm_business", revision: 0, answers: { ...answers, primaryChannel: "unsupported" } })).status, 400);
  assert.deepEqual(await files(), before);
});

test("business-only confirmation needs no goal, audience, offer, AI preview or positioning", async () => {
  const body = { action: "confirm_business", revision: 0, answers };
  const attempts = await Promise.all([call("/api/onboarding/interview", body), call("/api/onboarding/interview", body)]);
  assert.ok(attempts.some((result) => result.status === 200));
  assert.ok(attempts.every((result) => [200, 409].includes(result.status)));
  state = (await call("/api/onboarding/interview")).body.interview;
  assert.ok(state.confirmedBusiness.confirmedAt);
  assert.equal(state.preview, null);
  const onboarding = (await call("/api/onboarding/status")).body.status;
  assert.equal(onboarding.state, "completed");
  assert.ok(onboarding.completedSteps.includes("business"));
  assert.ok(!onboarding.completedSteps.includes("positioning"));
  assert.equal((await call("/api/positioning/current")).body.context, null);
  const knowledge = (await call("/api/knowledge-profile/current")).body.confirmed;
  assert.equal(knowledge.businessSummary, answers.business);
  assert.deepEqual(knowledge.targetCustomers, []);
  assert.deepEqual(knowledge.businessGoals, []);
  assert.deepEqual(knowledge.offers, []);
  assert.equal((await call("/api/materials")).body.materials.length, 1);
  const before = await files();
  assert.equal((await call("/api/onboarding/interview", body)).status, 200);
  assert.deepEqual(await files(), before, "duplicate confirmation must not rewrite business data");
  assert.equal((await call("/api/onboarding/interview", { ...body, answers: { ...answers, business: "过期回答" } })).status, 409);
  const quick = await fetch(base + "/create/quick", { headers: { authorization }, redirect: "manual" });
  if (quick.status === 307) assert.equal(quick.headers.get("location"), "/setup/first-content");
  else assert.match(await quick.text(), /\/setup\/first-content/);
});

test("an own topic reaches a reviewed draft with natural expression and no plan or style writes", async () => {
  const snapshot = (await call("/api/onboarding/first-content")).body;
  assert.equal(snapshot.positioningConfirmed, false);
  assert.equal(snapshot.confirmedProfile, null);
  const body = { action: "generate", topic: "介绍我们的鲜花花束服务", channel: "wechat_article", version: 0, useDefaultStyle: true };
  const invalid = await call("/api/onboarding/first-content", { ...body, channel: "unknown" });
  assert.equal(invalid.status, 400);
  const generated = await call("/api/onboarding/first-content", body);
  assert.equal(generated.status, 200, JSON.stringify(generated.body));
  const project = generated.body.project;
  assert.equal(project.topic, body.topic);
  assert.equal(project.accountSnapshot.status, "skipped");
  assert.equal(project.accountSnapshot.accountPosition, "");
  assert.equal(project.styleSnapshot, null);
  assert.equal(project.brief.contentGoal, "先介绍清楚本次真实业务");
  assert.equal(project.channelDrafts[0].channel, body.channel);
  assert.equal(project.channelDrafts[0].status, "generated");
  assert.ok(project.channelDrafts[0].review);
  assert.ok(project.selectedKnowledgeRefs.some((ref) => ref.excerpt.includes(answers.business)));
  assert.deepEqual((await call("/api/content-plans")).body.plans, []);
  assert.equal((await call("/api/style-profile/current")).body.profile, null);
  const changed = "用户确认的初稿：我们制作鲜花花束，提供花艺服务。";
  assert.equal((await call(`/api/content-drafts/${project.id}`, { channel: body.channel, content: changed }, "PATCH")).status, 200);
  const retry = await call("/api/onboarding/first-content", body);
  assert.equal(retry.body.project.id, project.id);
  assert.equal(retry.body.project.channelDrafts[0].content, changed);
  const before = await files();
  for (const url of ["/", "/setup", "/setup/first-content", "/api/onboarding/status", "/api/onboarding/first-content", `/drafts/${project.id}`, "/articles"]) {
    assert.equal((await fetch(base + url, { headers: { authorization } })).status, 200, url);
  }
  assert.deepEqual(await files(), before, "returning to saved business and drafts must be read-only");
});

test("skipping an AI direction keeps its preview pending and does not adopt its customer hypotheses", async () => {
  const nextAnswers = { ...answers, goal: "介绍新服务", offer: "花艺服务" };
  state = (await call("/api/onboarding/interview", { action: "preview", answers: nextAnswers, revision: state.revision })).body.interview;
  assert.ok(state.preview.account.targetAudience.some((audience) => audience.includes("待验证")));
  const previewId = state.preview.id;
  const confirmed = await call("/api/onboarding/interview", { action: "confirm_business", answers: nextAnswers, revision: state.revision });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.interview.preview.id, previewId);
  assert.equal(confirmed.body.interview.preview.confirmedAt, undefined);
  assert.equal((await call("/api/positioning/current")).body.context, null);
  assert.deepEqual((await call("/api/knowledge-profile/current")).body.confirmed.targetCustomers, []);
});

async function call(url, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + url, { method, headers: { authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function files() {
  return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async (name) => [name, (await readFile(path.join(directory, name))).toString("base64")])));
}
async function waitFor(url) {
  for (let index = 0; index < 150; index++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); }
  throw new Error(logs);
}
