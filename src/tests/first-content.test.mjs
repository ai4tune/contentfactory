import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.FIRST_CONTENT_TEST_PORT || 4401);
const base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("first:test-code").toString("base64")}`;
const children = [];
let directory, logs = "", style, project;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "first-content-"));
  for (const [script, env] of [
    ["src/tests/mock-ai-gateway.mjs", { MOCK_AI_PORT: String(port + 1) }],
    [".next/standalone/server.js", { HOSTNAME: "127.0.0.1", PORT: String(port), CONTENT_FACTORY_DATA_DIR: directory,
      CONTENT_FACTORY_ACCESS_USER: "first", CONTENT_FACTORY_ACCESS_CODE: "test-code", AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock",
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" }],
  ]) {
    const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; });
    await waitFor(script.startsWith("src") ? `http://127.0.0.1:${port + 1}/health` : `${base}/api/health`);
  }
});

after(async () => {
  for (const child of children.reverse()) { if (child.exitCode === null) { const exited = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; } }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("starter API requires login and confirmed business, validates choices", async () => {
  assert.equal((await fetch(`${base}/api/onboarding/first-content`)).status, 401);
  assert.equal((await call("/api/onboarding/first-content")).status, 409);
  const account = { source: "manual", input: {}, accountName: "首篇咖啡店", business: "提供咖啡饮品", offer: "咖啡饮品", conversionGoal: "介绍已知业务", accountPosition: "介绍本店咖啡", targetAudience: ["附近顾客（待验证）"], platforms: ["朋友圈"], contentPillars: ["业务介绍"], brandVoice: ["自然"], preferredPhrases: [], bannedPhrases: [], contentDirections: [], recommendedTopics: [], analysisEvidence: [], informationGaps: ["风味、价格、作者经历未提供"] };
  assert.equal((await call("/api/positioning/current", { action: "confirm", draft: account }, "PATCH")).status, 200);
  await call("/api/onboarding/status", { action: "complete", primaryChannel: "moments_post" }, "PATCH");
  for (const body of [
    { action: "preview_style", version: 0, industry: "unknown", voice: "chat" },
    { action: "preview_style", version: 0, industry: "coffee", voice: "unknown" },
    { action: "preview_style", version: 0, industry: "coffee", voice: "chat", adjustments: "长".repeat(501) },
    { action: "confirm_style", version: -1 },
  ]) assert.equal((await call("/api/onboarding/first-content", body)).status, 400);
  assert.equal((await call("/api/onboarding/first-content", { action: "generate", topicId: "intro", version: 0 })).status, 409);
});

test("three examples share actual facts; draft and stale requests cannot replace confirmed style", async () => {
  const snapshot = (await call("/api/onboarding/first-content?industry=coffee")).body;
  assert.equal(snapshot.options.length, 3); assert.equal(snapshot.topics.length, 3);
  for (const option of snapshot.options) { assert.match(option.sample, /首篇咖啡店|提供咖啡饮品/); assert.doesNotMatch(option.sample, /果香|坚果|昨天|朋友问|最低价/); }
  style = (await call("/api/onboarding/first-content", { action: "preview_style", industry: "coffee", voice: "chat", adjustments: "更口语一点，少用感叹号", version: 0 })).body.profile;
  assert.equal(style.status, "draft"); assert.equal(style.starterTemplate.version, 1);
  assert.equal((await call("/api/onboarding/first-content")).body.confirmedProfile, null);
  assert.equal((await call("/api/onboarding/first-content", { action: "preview_style", industry: "flooring", voice: "professional", version: 0 })).status, 409);
  style = (await call("/api/onboarding/first-content", { action: "confirm_style", version: style.version })).body.profile;
  assert.equal(style.status, "confirmed"); assert.equal(style.starterTemplate.industry, "coffee");
  assert.ok(style.rules.some((rule) => rule.instruction.includes("少用感叹号")));
  const custom = { ...style, preferredPhrases: ["先说已知信息"], bannedPhrases: ["最低价"], channelOverrides: { moments_post: ["不用感叹号"] }, rules: [...style.rules, { id: "customer-rule", category: "language", priority: "hard", instruction: "保留客户自己的表达习惯", evidence: style.rules[0].evidence }] };
  style = (await call("/api/style-profile/current", { action: "confirm", profile: custom }, "PATCH")).body.profile;
  const draft = (await call("/api/onboarding/first-content", { action: "preview_style", industry: "coffee", voice: "professional", adjustments: "句子简短", version: style.version })).body.profile;
  assert.equal((await call("/api/onboarding/first-content")).body.confirmedProfile.version, style.version);
  assert.equal((await call("/api/onboarding/first-content", { action: "confirm_style", version: style.version })).status, 409);
  style = (await call("/api/onboarding/first-content", { action: "confirm_style", version: draft.version })).body.profile;
  assert.ok(style.rules.some((rule) => rule.id === "customer-rule")); assert.ok(style.bannedPhrases.includes("最低价"));
  assert.ok(style.preferredPhrases.includes("先说已知信息")); assert.deepEqual(style.channelOverrides.moments_post, ["不用感叹号"]);
});

test("first topic reaches ideas, a reviewed draft and body-only export without a 30-day plan", async () => {
  const generated = await call("/api/onboarding/first-content", { action: "generate", topicId: "intro", version: style.version });
  assert.equal(generated.status, 200, JSON.stringify(generated.body)); project = generated.body.project;
  assert.equal(project.channelDrafts[0].status, "generated"); assert.ok(project.channelDrafts[0].review);
  assert.match(project.channelDrafts[0].content, /首篇咖啡店/); assert.ok(project.sourceIdeaId.startsWith("starter_"));
  assert.ok((await call("/api/ideas")).body.data.some((idea) => idea.id === project.sourceIdeaId && idea.status === "used"));
  assert.deepEqual((await call("/api/content-plans")).body.plans, []);
  const changed = "人工确认正文：我们提供咖啡饮品。";
  await call(`/api/content-drafts/${project.id}`, { channel: "moments_post", content: changed }, "PATCH");
  const retry = await call("/api/onboarding/first-content", { action: "generate", topicId: "intro", version: style.version });
  assert.equal(retry.body.project.id, project.id); assert.equal(retry.body.project.channelDrafts[0].content, changed);
  assert.equal((await call("/api/onboarding/first-content")).body.topics[0].projectId, project.id);
  const response = await fetch(`${base}/api/content-drafts/${project.id}/export?channel=moments_post`, { headers: { authorization } });
  assert.equal(await response.text(), `${changed}\n`);
  const bundle = await fetch(`${base}/api/content-drafts/${project.id}/export`, { headers: { authorization } });
  assert.match(await bundle.text(), /## 内容简报/);
  assert.equal((await call("/api/onboarding/first-content", { action: "generate", topicId: "forged", version: style.version })).status, 400);
  const parallel = await Promise.all([1, 2].map(() => call("/api/onboarding/first-content", { action: "generate", topicId: "offer", version: style.version })));
  assert.ok(parallel.every((result) => result.status === 200));
  assert.equal(parallel[0].body.project.id, parallel[1].body.project.id);
  const ideas = (await call("/api/ideas")).body.data.filter((idea) => idea.id === parallel[0].body.project.sourceIdeaId);
  assert.equal(ideas.length, 1);
});

test("unsupported drafts are corrected once; persistent or unavailable checks never deliver an unsafe body", async () => {
  for (const [marker, expected] of [["验收自动修正", "generated"], ["验收持续虚构", "failed"], ["验收核对不可用", "failed"], ["验收核对格式错误", "failed"], ["验收已有风味", "generated"]]) {
    const sources = [{ id: "upload:coffee", title: "业务原话", source: "upload", text: marker === "验收已有风味" ? "已确认提供果香咖啡。" : "提供咖啡饮品，未提供风味和经历。" }];
    const brief = { targetAudience: "顾客", contentGoal: "介绍", coreMessage: marker, keyPoints: ["提供咖啡饮品"], outline: ["介绍已知业务"], callToAction: "提问", citations: [{ sourceId: sources[0].id, sourceTitle: sources[0].title, sourceType: "upload", excerpt: sources[0].text, purpose: "已知业务" }], openQuestions: ["风味待补充"] };
    const result = await call("/api/content/generate", { topic: marker, brief, sources, channels: ["moments_post"] });
    assert.equal(result.status, 200); const draft = result.body.project.channelDrafts[0];
    assert.equal(draft.status, expected);
    if (expected === "generated") assert.equal(draft.content, marker === "验收已有风味" ? "我们提供果香咖啡。" : "我们提供咖啡饮品。");
    else { assert.equal(draft.content, ""); assert.match(draft.error, /资料不足|事实核对|核对暂时/); }
  }
});

async function call(url, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + url, { method, headers: { authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function waitFor(url) { for (let index = 0; index < 100; index++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); } throw new Error(logs); }
