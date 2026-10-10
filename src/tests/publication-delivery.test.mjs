import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.PUBLICATION_DELIVERY_TEST_PORT || 4467);
const base = `http://127.0.0.1:${port}`;
const headers = { authorization: `Basic ${Buffer.from("starter:test-code").toString("base64")}`, "content-type": "application/json" };
const children = [];
let directory, project, logs = "";

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "contentfactory-delivery-"));
  for (const [script, env] of [
    ["src/tests/mock-ai-gateway.mjs", { MOCK_AI_PORT: String(port + 1), MOCK_PHOTO_DELAY_MS: "700" }],
    [".next/standalone/server.js", { HOSTNAME: "127.0.0.1", PORT: String(port), CONTENT_FACTORY_DATA_DIR: directory,
      CONTENT_FACTORY_ACCESS_USER: "starter", CONTENT_FACTORY_ACCESS_CODE: "test-code", CONTENT_FACTORY_PREVIEW_MODE: "mock_ai",
      AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock",
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CONTENT_FACTORY_WORKSPACE_ID: "" }],
  ]) {
    const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child); child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; });
    const url = script.startsWith("src") ? `http://127.0.0.1:${port + 1}/health` : base + "/api/health";
    for (let index = 0; index < 100; index++) { try { if ((await fetch(url)).ok) break; } catch {} if (index === 99) throw new Error(logs); await delay(100); }
  }
  await call("/api/onboarding/interview", { action: "confirm_business", revision: 0, answers: { accountName: "交付测试花艺", business: "制作鲜花花束，提供花艺服务", primaryChannel: "wechat_article" } });
});

after(async () => {
  for (const child of children.reverse()) if (child.exitCode === null) { const exited = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; }
  await rm(directory, { recursive: true, force: true });
});

test("structured publication separates titles and photos, and keeps a temporary style private to the project", async () => {
  const result = await call("/api/onboarding/first-content", { action: "generate", topic: "验收发布交付：花束服务介绍", version: 0, useDefaultStyle: true, temporaryStyleInstructions: ["仅这篇更口语"] });
  assert.equal(result.status, 200, JSON.stringify(result.body)); project = result.body.project;
  const draft = project.channelDrafts[0];
  assert.equal(draft.delivery.title, "认识我们的花束服务");
  assert.ok(!draft.content.includes("这是一段不复制进正文的摘要"));
  assert.ok(!draft.content.includes(draft.delivery.titleOptions[0]));
  assert.equal(draft.photoPlan.suggestions[0].subject, "本次实际制作的花束");
  assert.equal(draft.photoPlan.basedOnContentUpdatedAt, draft.updatedAt, "review metadata must not make a new photo plan stale");
  assert.equal(draft.review.reviewedTitle, draft.delivery.title);
  assert.deepEqual(project.temporaryStyleInstructions, ["仅这篇更口语"]);
  assert.equal((await call("/api/style-profile/current")).body.profile, null);
  const other = await call("/api/onboarding/first-content", { action: "generate", topic: project.topic, version: 0, useDefaultStyle: true, temporaryStyleInstructions: ["仅这篇专业一些"] });
  assert.notEqual(other.body.project.id, project.id);
  assert.equal((await call("/api/style-profile/current")).body.profile, null);
});

test("exports contain only the selected publication and require human approval for HTML", async () => {
  const url = `/api/content-drafts/${project.id}/export?channel=wechat_article`;
  const markdown = await fetch(base + url, { headers });
  const text = await markdown.text();
  assert.match(text, /^# 认识我们的花束服务/);
  assert.ok(!text.includes("先聊聊花束制作")); assert.ok(!text.includes("这是一段不复制进正文的摘要")); assert.ok(!text.includes("用自然光拍摄主体")); assert.ok(!text.includes("内容简报"));
  const archive = await (await fetch(base + `/api/content-drafts/${project.id}/export`, { headers })).text();
  assert.ok(archive.includes("内容简报")); assert.ok(archive.includes("# 认识我们的花束服务"), "project export must retain the separate publication title");
  assert.equal((await fetch(base + url + "&format=html", { headers })).status, 409);
  const current = (await call(`/api/content-drafts/${project.id}`)).body.draft;
  assert.equal((await call(`/api/content-drafts/${project.id}`, { reviewStatus: "approved", expectedUpdatedAt: current.updatedAt }, "PATCH")).status, 200);
  const response = await fetch(base + url + "&format=html", { headers });
  assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /<strong[^>]*>鲜花花束<\/strong>/); assert.match(html, /style=/); assert.ok(!html.includes("备选标题"));
});

test("title editing preserves the previous delivery and stale writes cannot overwrite a saved revision", async () => {
  const current = (await call(`/api/content-drafts/${project.id}`)).body.draft.channelDrafts[0];
  const body = { channel: "wechat_article", content: current.content + "\n\n<script>alert(1)</script>", title: "我确认的花束服务介绍", expectedUpdatedAt: current.updatedAt };
  const saved = await call(`/api/content-drafts/${project.id}`, body, "PATCH");
  assert.equal(saved.status, 200); assert.equal(saved.body.draft.reviewStatus, "editing"); assert.equal(saved.body.draft.channelDrafts[0].review, undefined);
  assert.equal(saved.body.draft.versions.at(-1).delivery.title, current.delivery.title);
  assert.equal((await call(`/api/content-drafts/${project.id}`, { ...body, content: "过期覆盖" }, "PATCH")).status, 409);
  const latest = (await call(`/api/content-drafts/${project.id}`)).body.draft;
  assert.equal(latest.channelDrafts[0].content, body.content);
  assert.equal((await call(`/api/content-drafts/${project.id}`, { reviewStatus: "approved", expectedUpdatedAt: latest.updatedAt }, "PATCH")).status, 200);
  const html = await (await fetch(base + `/api/content-drafts/${project.id}/export?channel=wechat_article&format=html`, { headers })).text();
  assert.ok(!html.includes("<script>")); assert.match(html, /&lt;script&gt;/);
});

test("photo suggestions cannot be saved against a changed draft", async () => {
  const current = (await call(`/api/content-drafts/${project.id}`)).body.draft.channelDrafts[0];
  const url = `/api/content/projects/${project.id}/channels/wechat_article/photos`;
  assert.equal((await call(url, { expectedUpdatedAt: "stale" })).status, 409);
  const pending = call(url, { expectedUpdatedAt: current.updatedAt });
  await delay(150);
  const saved = await call(`/api/content-drafts/${project.id}`, { channel: "wechat_article", content: current.content + "\n继续核对。", expectedUpdatedAt: current.updatedAt }, "PATCH");
  assert.equal(saved.status, 200); assert.equal((await pending).status, 409);
  const latest = saved.body.draft.channelDrafts[0];
  assert.equal((await call(url, { expectedUpdatedAt: latest.updatedAt })).status, 200);
  const updated = (await call(`/api/content-drafts/${project.id}`)).body.draft.channelDrafts[0];
  assert.equal(updated.content, latest.content); assert.equal(updated.photoPlan.basedOnContentUpdatedAt, updated.updatedAt);
});

test("a fabricated photo source is rejected instead of delivered as a real shop suggestion", async () => {
  const before = (await call(`/api/content-drafts/${project.id}`)).body.draft;
  const result = await call("/api/onboarding/first-content", { action: "generate", topic: "验收发布交付：验收非法实拍来源", version: 0, useDefaultStyle: true });
  assert.equal(result.status, 500); assert.match(result.body.error, /可核对的资料/);
  assert.deepEqual((await call(`/api/content-drafts/${project.id}`)).body.draft, before);
});

test("new delivery views and exports remain read-only and unauthenticated requests are rejected", async () => {
  const before = await files();
  for (const url of [`/drafts/${project.id}`, `/api/content-drafts/${project.id}`, `/api/content-drafts/${project.id}/export?channel=wechat_article`, "/articles"]) assert.equal((await fetch(base + url, { headers })).status, 200);
  assert.deepEqual(await files(), before);
  assert.equal((await fetch(base + `/api/content/projects/${project.id}/channels/wechat_article/photos`, { method: "POST", body: "{}" })).status, 401);
  const response = await fetch(base + `/drafts/${project.id}`, { headers }); assert.match(await response.text(), /使用模拟 AI/);
});

async function call(url, body, method = body ? "POST" : "GET") { const response = await fetch(base + url, { headers, method, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, body: await response.json() }; }
async function files() { return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async (name) => [name, (await readFile(path.join(directory, name))).toString("base64")]))); }
