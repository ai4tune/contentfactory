import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
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
  const account = { source: "manual", input: {}, accountName: "晨光设计工作室", business: "提供品牌视觉设计服务", offer: "品牌视觉设计", conversionGoal: "介绍已知业务", accountPosition: "介绍品牌视觉设计", targetAudience: ["需要设计服务的客户（待验证）"], platforms: ["朋友圈"], contentPillars: ["业务介绍"], brandVoice: ["自然"], preferredPhrases: [], bannedPhrases: [], contentDirections: [], recommendedTopics: [], analysisEvidence: [], informationGaps: ["风味、价格、作者经历未提供"] };
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
  const snapshot = (await call("/api/onboarding/first-content")).body;
  assert.equal(snapshot.options.length, 3); assert.equal(snapshot.topics.length, 3);
  for (const url of ["/setup/first-content", "/setup/interview"]) {
    const html = await (await fetch(base + url, { headers: { authorization } })).text();
    assert.doesNotMatch(html, /贝尔咖啡|一家独立咖啡店|木板 \/ 地板装修/);
  }
  for (const option of snapshot.options) { assert.match(option.sample, /晨光设计工作室|提供品牌视觉设计服务/); assert.doesNotMatch(option.sample, /咖啡|地板|果香|坚果|昨天|朋友问|最低价/); }
  style = (await call("/api/onboarding/first-content", { action: "preview_style", voice: "chat", adjustments: "更口语一点，少用感叹号", version: 0 })).body.profile;
  assert.equal(style.status, "draft"); assert.equal(style.starterTemplate.version, 3);
  assert.equal((await call("/api/onboarding/first-content")).body.confirmedProfile, null);
  assert.equal((await call("/api/onboarding/first-content", { action: "preview_style", industry: "flooring", voice: "professional", version: 0 })).status, 409);
  style = (await call("/api/onboarding/first-content", { action: "confirm_style", version: style.version })).body.profile;
  assert.equal(style.status, "confirmed"); assert.equal(style.starterTemplate.industry, "general");
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
  assert.match(project.channelDrafts[0].content, /晨光设计工作室/); assert.ok(project.sourceIdeaId.startsWith("starter_"));
  assert.ok((await call("/api/ideas")).body.data.some((idea) => idea.id === project.sourceIdeaId && idea.status === "used"));
  assert.deepEqual((await call("/api/content-plans")).body.plans, []);
  const changed = "人工确认正文：我们提供品牌视觉设计服务。";
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

test("template comparison is read-only; explicit upgrade preserves personal rules and unknown legacy fields", async () => {
  const file = path.join(directory, "style-profiles.local.json");
  const store = JSON.parse(await readFile(file, "utf8"));
  store.confirmedProfile.starterTemplate.version = 1;
  store.confirmedProfile.customerOwnedField = { keep: "customer data" };
  store.futureStoreField = { keep: "future data" };
  store.confirmedProfile.rules.find((rule) => rule.id === "starter-rule-extra").priority = "hard";
  const edited = store.confirmedProfile.rules.find((rule) => rule.id === "starter-rule-0");
  edited.instruction = "我自己改过的模板规则，不要催促读者";
  await writeFile(file, JSON.stringify(store));
  const original = await readFile(file, "utf8");
  const before = (await call("/api/onboarding/first-content")).body;
  const comparison = await call("/api/onboarding/first-content", { action: "compare_style", voice: "lifestyle", adjustments: "句子简短", version: before.profileVersion });
  assert.equal(comparison.status, 200);
  assert.ok(comparison.body.differences.some((item) => item.label === "语气"));
  assert.equal(await readFile(file, "utf8"), original);
  assert.deepEqual((await call("/api/onboarding/first-content")).body.confirmedProfile, before.confirmedProfile);
  assert.ok(comparison.body.profile.rules.some((rule) => rule.instruction === edited.instruction));
  assert.ok(comparison.body.profile.rules.some((rule) => rule.id === "starter-rule-extra" && rule.instruction === "句子简短" && rule.priority === "hard"));
  const preview = await call("/api/onboarding/first-content", { action: "preview_style", voice: "lifestyle", adjustments: "", version: before.profileVersion });
  assert.equal(preview.status, 200);
  assert.deepEqual((await call("/api/onboarding/first-content")).body.confirmedProfile, before.confirmedProfile);
  assert.deepEqual(preview.body.profile.customerOwnedField, store.confirmedProfile.customerOwnedField);
  const confirmed = await call("/api/onboarding/first-content", { action: "confirm_style", version: preview.body.profile.version });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.profile.starterTemplate.version, 3);
  assert.ok(confirmed.body.profile.bannedPhrases.includes("最低价"));
  assert.deepEqual(confirmed.body.profile.channelOverrides.moments_post, ["不用感叹号"]);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")).futureStoreField, store.futureStoreField);
  for (const action of ["compare_style", "preview_style"]) assert.equal((await call("/api/onboarding/first-content", { action, voice: "chat", version: before.profileVersion })).status, 409);
  assert.equal((await call("/api/style-profile/current", { action: "confirm", profile: confirmed.body.profile, version: before.profileVersion }, "PATCH")).status, 409);
});

test("style analysis is a preview and keeps customer prohibitions and channel preferences", async () => {
  const file = path.join(directory, "style-profiles.local.json");
  const original = await readFile(file, "utf8");
  const sources = [
    { id: "local:style guide.md", title: "我的风格指南", source: "upload", role: "style_guide", text: "不要大量使用一句一段的短句结构。\n禁用表达：深度赋能。" },
    { id: "local:approved sample.md", title: "自己的历史文章", source: "upload", role: "approved_sample", text: "我之前一直以为工具选对就够了，后来真正到企业里跑了一遍，才发现问题往往不在工具。\n这只是我跑完真实项目后的阶段性判断。" },
  ];
  const result = await call("/api/style-profile/analyze", { sources });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.ok(result.body.profile.bannedPhrases.includes("最低价"));
  assert.deepEqual(result.body.profile.channelOverrides.moments_post, ["不用感叹号"]);
  assert.ok(result.body.profile.examples.some((item) => sources.some((source) => source.text.includes(item.excerpt))));
  assert.equal(await readFile(file, "utf8"), original);
});

test("history analysis keeps today's business and goal, and never confirms positioning implicitly", async () => {
  const current = (await call("/api/positioning/current")).body.context;
  const file = path.join(directory, "contentfactory.local.json");
  const store = JSON.parse(await readFile(file, "utf8"));
  store.accountCaptures = [{ accountName: "以前的账号名称", platform: "公众号", sourceUrl: "https://example.com/old-account", bio: "以前的业务", pageType: "account", capturedAt: "2026-01-01T00:00:00Z", contents: [{ title: "以前的话题", description: "历史正文只供参考", metrics: {} }], accountMetrics: {}, operationalMetrics: {} }];
  await writeFile(file, JSON.stringify(store));
  const original = await readFile(file, "utf8");
  const refreshed = await call("/api/positioning/refresh-capture", { current: { ...current, audience: "今天的目标客户", goal: "今天希望介绍新服务", currentContent: "用户补充资料" } });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.equal(refreshed.body.draft.input.accountName, current.accountName);
  assert.equal(refreshed.body.draft.input.business, current.business);
  assert.equal(refreshed.body.draft.input.goal, "今天希望介绍新服务");
  assert.equal(refreshed.body.draft.input.audience, "今天的目标客户");
  assert.match(refreshed.body.draft.input.currentContent, /历史正文只供参考/);
  assert.match(refreshed.body.draft.input.currentContent, /用户补充资料/);
  assert.deepEqual((await call("/api/positioning/current")).body.context, current);
  assert.equal(await readFile(file, "utf8"), original);
  for (const url of ["/brand", "/brand?step=positioning", "/brand?step=style", "/style-profile"]) {
    const response = await fetch(base + url, { headers: { authorization } });
    assert.equal(response.status, 200);
    const html = await response.text();
    if (url === "/brand") assert.match(html, /品牌资料与历史/);
    if (url === "/brand?step=style") assert.match(html, /我来描述风格/);
  }
});

async function call(url, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + url, { method, headers: { authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function waitFor(url) { for (let index = 0; index < 100; index++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); } throw new Error(logs); }
