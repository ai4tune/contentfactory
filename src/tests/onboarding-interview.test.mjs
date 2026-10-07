import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.INTERVIEW_TEST_PORT || 4391);
const aiPort = port + 1;
const base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("interview:test-code").toString("base64")}`;
const processes = [];
let dataDirectory, output = "";

before(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "contentfactory-interview-"));
  const mock = spawn(process.execPath, [path.join(root, "src/tests/mock-ai-gateway.mjs")], {
    cwd: root, env: { ...process.env, MOCK_AI_PORT: String(aiPort) }, stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(mock);
  await waitFor(`http://127.0.0.1:${aiPort}/health`);
  const app = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], {
    cwd: root, env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port),
      AI_BASE_URL: `http://127.0.0.1:${aiPort}/v1`, AI_API_KEY: "test-only", AI_MODEL: "acceptance-mock",
      CONTENT_FACTORY_DATA_DIR: dataDirectory, CONTENT_FACTORY_ACCESS_USER: "interview", CONTENT_FACTORY_ACCESS_CODE: "test-code",
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", UPLOADS_ENABLED: "true",
    }, stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (chunk) => { output += chunk; });
  app.stderr.on("data", (chunk) => { output += chunk; });
  processes.push(app);
  await waitFor(`${base}/api/health`);
});

after(async () => {
  for (const child of processes.reverse()) {
    child.kill("SIGTERM");
    if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
  }
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

test("a merchant with no files or historical account can confirm an interview and reuse its facts", async (context) => {
  const answers = { accountName: "访谈验收店", business: "独立咖啡店", goal: "增加工作日客流", offer: "手冲咖啡",
    audience: "", differentiator: "提供咖啡豆选择介绍", boundaries: "不写未经确认的优惠价格", tone: "像老板聊天", primaryChannel: "moments_post" };
  let state, edits, confirmed;

  await context.test("authentication and invalid requests fail before writing", async () => {
    assert.equal((await fetch(`${base}/api/onboarding/interview`)).status, 401);
    assert.equal((await request("/api/onboarding/interview", { action: "preview", revision: 0, answers: {} })).status, 400);
    assert.equal((await request("/api/onboarding/interview", { action: "save", revision: 0, step: 0, answers: { ...answers, business: [] } })).status, 400);
    assert.equal((await request("/api/onboarding/interview", { action: "save", revision: 0, step: 0, answers: { ...answers, accountName: "长".repeat(121) } })).status, 400);
    assert.equal((await request("/api/onboarding/interview", { action: "save", revision: 0, step: 0, answers: { ...answers, primaryChannel: "unsupported" } })).status, 400);
    assert.equal((await request("/api/onboarding/interview", { action: "confirm", revision: 0, previewId: "forged" })).status, 409);
    state = (await json("/api/onboarding/interview")).interview;
    assert.equal(state.revision, 0);
  });

  await context.test("answers survive a reload and stale pages cannot overwrite them", async () => {
    state = (await json("/api/onboarding/interview", { action: "save", revision: state.revision, step: 3, answers })).interview;
    const restored = (await json("/api/onboarding/interview")).interview;
    assert.deepEqual(restored, state);
    assert.equal(restored.step, 3);
    assert.equal((await request("/api/onboarding/interview", { action: "save", revision: 0, step: 0, answers: { ...answers, business: "过期回答" } })).status, 409);
    assert.equal((await json("/api/positioning/current")).context, null);
    assert.deepEqual((await json("/api/materials")).materials, []);
  });

  await context.test("AI failure preserves the latest raw answers for retry", async () => {
    const failed = await request("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: { ...answers, goal: "验收访谈失败" } });
    assert.equal(failed.status, 500);
    state = (await json("/api/onboarding/interview")).interview;
    assert.equal(state.answers.goal, "验收访谈失败");
    assert.equal(state.preview, null);
    assert.equal((await json("/api/knowledge-profile/current")).confirmed, null);
  });

  await context.test("preview keeps unknown customers as hypotheses and does not confirm any facts", async () => {
    state = (await json("/api/onboarding/interview", { action: "preview", revision: state.revision, answers })).interview;
    assert.ok(state.preview.id);
    assert.match(state.preview.account.accountPosition, /增加工作日客流/);
    assert.match(state.preview.account.informationGaps.join("\n"), /待验证/);
    assert.equal((await json("/api/positioning/current")).context, null);
    assert.equal((await json("/api/knowledge-profile/current")).confirmed, null);
    assert.deepEqual((await json("/api/materials")).materials, []);
    edits = { accountPosition: "介绍本店手冲咖啡，尝试增加工作日到店", targetAudience: ["附近上班的人（待验证）"], contentPillars: ["咖啡介绍", "店铺日常", "到店场景"] };
    assert.equal((await request("/api/onboarding/interview", { action: "confirm", revision: state.revision, previewId: "other-preview", edits })).status, 409);
  });

  await context.test("confirmation saves user edits and traceable raw knowledge exactly once", async () => {
    const revision = state.revision;
    const payload = { action: "confirm", revision, previewId: state.preview.id, edits };
    const attempts = await Promise.all([request("/api/onboarding/interview", payload), request("/api/onboarding/interview", payload)]);
    assert.ok(attempts.some((response) => response.status === 200));
    assert.ok(attempts.every((response) => response.status === 200 || response.status === 409));
    state = (await attempts.find((response) => response.status === 200).json()).interview;
    assert.ok(state.preview.confirmedAt);
    confirmed = (await json("/api/knowledge-profile/current")).confirmed;
    const account = (await json("/api/positioning/current")).context;
    assert.equal(account.accountPosition, edits.accountPosition);
    assert.deepEqual(account.targetAudience, edits.targetAudience);
    assert.deepEqual(account.contentPillars, edits.contentPillars);
    assert.deepEqual(confirmed.targetCustomers, [], "AI customer hypotheses must not become factual brand knowledge");
    const materials = (await json("/api/materials")).materials;
    assert.equal(materials.length, 1);
    assert.match(materials[0].text, /主营业务：独立咖啡店/);
    assert.match(materials[0].text, /本次经营目标：增加工作日客流/);
    assert.match(materials[0].text, /顾客与使用场景：尚不确定/);
    assert.doesNotMatch(materials[0].text, /附近上班的人/);
    assert.equal(confirmed.sources[0].id, materials[0].id);
    assert.equal(confirmed.facts[0].sourceIds[0], materials[0].id);
    const onboarding = (await json("/api/onboarding/status")).status;
    assert.equal(onboarding.state, "completed");
    assert.equal(onboarding.primaryChannel, "moments_post");
    assert.equal(onboarding.knowledgeReadiness, "ready");
    assert.equal((await json("/api/onboarding/interview", payload)).interview.preview.id, state.preview.id);
    assert.equal((await json("/api/materials")).materials.length, 1);
    assert.equal((await json("/api/knowledge-profile/current")).confirmed.version, confirmed.version);
  });

  await context.test("the interview material reaches the existing plan and quick-creation flow without an upload", async () => {
    let plan = (await json("/api/content-plans", { operatingGoal: answers.goal, primaryChannel: "moments_post" })).plan;
    assert.ok(plan.id);
    plan = (await json(`/api/content-plans/${plan.id}`, { status: "confirmed" }, "PATCH")).plan;
    const sources = (await json("/api/materials")).materials;
    const generated = await json("/api/content/quick/generate", { contentPlanId: plan.id, contentPlanItemId: plan.items[0].id, channel: "moments_post", sources });
    assert.ok(generated.project.id);
    assert.equal(generated.project.selectedKnowledgeRefs[0].sourceId, sources[0].id);
    assert.equal(generated.project.knowledgeProfileVersion, confirmed.version);
    assert.equal(generated.project.accountSnapshot.conversionGoal, answers.goal);
    assert.equal(generated.project.channelDrafts[0].status, "generated");
  });

  await context.test("a later interview preserves existing knowledge and changes nothing until confirmed", async () => {
    const previous = (await json("/api/positioning/current")).context;
    state = (await json("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: { ...answers, goal: "让老客知道新品", offer: "新款咖啡" } })).interview;
    assert.deepEqual((await json("/api/positioning/current")).context, previous);
    assert.equal((await json("/api/knowledge-profile/current")).confirmed.id, confirmed.id);
    state = (await json("/api/onboarding/interview", { action: "confirm", revision: state.revision, previewId: state.preview.id,
      edits: { accountPosition: state.preview.account.accountPosition, targetAudience: state.preview.account.targetAudience, contentPillars: state.preview.account.contentPillars } })).interview;
    const profile = (await json("/api/knowledge-profile/current")).confirmed;
    assert.ok(profile.sources.some((source) => source.id === confirmed.sources[0].id));
    assert.ok(profile.facts.some((fact) => fact.id === confirmed.facts[0].id));
    assert.deepEqual(profile.businessGoals, ["让老客知道新品"]);
    assert.equal((await json("/api/materials")).materials.length, 2);
  });
});

async function request(url, body, method = body === undefined ? "GET" : "POST") {
  return fetch(`${base}${url}`, { method, headers: { Authorization: authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json(url, body, method) {
  const response = await request(url, body, method);
  const payload = await response.json();
  assert.ok(response.ok, `${url}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}
async function waitFor(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* server startup */ }
    await delay(100);
  }
  throw new Error(`Server startup failed: ${output}`);
}
