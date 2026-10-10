import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.AGENT_CHAT_TEST_PORT || 4570), base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("contentfactory:agent-test").toString("base64")}`;
const children = [];
let directory, app, env, logs = "", conversationId, generatedId;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "contentfactory-agent-test-"));
  env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "",
    CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_CODE: "agent-test", HOSTNAME: "127.0.0.1", PORT: String(port),
    AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock", MOCK_AI_PORT: String(port + 1),
    WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: base };
  start("src/tests/mock-ai-gateway.mjs"); await waitFor(`http://127.0.0.1:${port + 1}/health`);
  app = start(".next/standalone/server.js"); await waitFor(`${base}/api/health`);
});
after(async () => { for (const child of children.reverse()) await stop(child); await rm(directory, { recursive: true, force: true }); });

test("empty chat and invalid requests do not write existing data", async () => {
  assert.equal((await fetch(base + "/api/agent/chat")).status, 401);
  const before = await files();
  assert.deepEqual((await call("/api/agent/chat")).body.conversations, []);
  assert.equal((await call("/api/agent/chat", { requestId: "invalid", content: "hello", workspaceId: "foreign" })).status, 400);
  assert.equal((await call("/api/agent/chat", { requestId: "invalid", content: "hello", sources: [{ id: "x", title: "x", source: "local", text: "x".repeat(12001) }] })).status, 400);
  assert.deepEqual(await files(), before);
});
test("real tool execution saves one reviewed draft, duplicate submissions reuse it", async () => {
  const answers = { accountName: "验收花店", business: "制作鲜花花束，提供花艺服务", goal: "", offer: "", audience: "", tone: "", boundaries: "", industry: "general", primaryChannel: "wechat_article" };
  assert.equal((await call("/api/onboarding/interview", { action: "confirm_business", revision: 0, answers })).status, 200);
  const input = { requestId: "write-one", content: "验收写作：用鲜花资料写一篇", sources: [{ id: "local:new-product", title: "本周花束素材", source: "local", text: "我们制作鲜花花束。", path: "素材/花束.md" }] };
  const duplicate = await Promise.all([call("/api/agent/chat", input), call("/api/agent/chat", input)]);
  assert.ok(duplicate.every((item) => [200, 202].includes(item.status)), JSON.stringify(duplicate));
  assert.equal(duplicate[0].body.turn.id, duplicate[1].body.turn.id);
  const turn = await waitTurn(duplicate[0].body.turn.id, "completed");
  conversationId = turn.conversationId;
  assert.ok(turn.tools.some((item) => item.name === "load_skill" && item.status === "succeeded"));
  const result = turn.tools.find((item) => item.name === "create_draft").output;
  generatedId = result.projectId;
  assert.equal(result.published, false); assert.equal(result.reviewed, true);
  const project = (await call(`/api/content-drafts/${generatedId}`)).body.draft;
  assert.ok(project.channelDrafts[0].review);
  assert.match(project.channelDrafts[0].content, /花束/);
  assert.ok(turn.tools.find((item) => item.name === "create_draft").draftSources.some((item) => item.id === "local:new-product" && item.text === input.sources[0].text));
  assert.equal((await call("/api/agent/chat", input)).body.turn.id, turn.id);
  assert.equal((await call("/api/agent/chat", { ...input, content: "不同请求" })).status, 409);
  assert.equal((await call("/api/agent/chat")).body.conversations[0].messages.length, 2);
});
test("account memory is explicit, editable and forgettable; temporary instructions do not change business", async () => {
  const state = (await call("/api/agent/chat")).body;
  assert.deepEqual(state.memories, []);
  const sourceMessageId = state.conversations[0].messages[0].id;
  const previous = await files(["agent-chat.local.json"]);
  assert.equal((await call("/api/agent/chat/memories/voice", { sourceMessageId, content: "以后少用营销话术" }, "PATCH")).status, 200);
  assert.equal((await call("/api/agent/chat/memories/voice", { sourceMessageId: "foreign-message", content: "别人的人设" }, "PATCH")).status, 404);
  assert.equal((await call("/api/agent/chat/memories/voice", { sourceMessageId, content: "本次更正：自然清楚" }, "PATCH")).status, 200);
  assert.deepEqual((await call("/api/agent/chat")).body.memories.map((item) => item.content), ["本次更正：自然清楚"]);
  assert.equal((await call("/api/agent/chat/memories/voice", { sourceMessageId, content: "" }, "PATCH")).status, 200);
  assert.deepEqual((await call("/api/agent/chat")).body.memories, []);
  assert.deepEqual(await files(["agent-chat.local.json"]), previous);
});
test("the next turn can read the preceding saved draft and earlier selected knowledge by their real IDs", async () => {
  const previous = await files(["agent-chat.local.json"]);
  const turn = (await call("/api/agent/chat", { requestId: "follow-up", conversationId, content: "验收续聊：刚才这篇用到了哪些资料，先不要生成新的" })).body.turn;
  const completed = await waitTurn(turn.id, "completed");
  const draft = completed.tools.find((item) => item.name === "read_content").output;
  assert.equal(draft.id, generatedId);
  assert.equal(draft.reviewStatus, "draft");
  assert.deepEqual(draft.publications, []);
  assert.equal(completed.tools.find((item) => item.name === "read_knowledge").output.id, "local:new-product");
  assert.ok(!completed.tools.some((item) => item.name === "create_draft"));
  const answer = (await call("/api/agent/chat")).body.conversations[0].messages.at(-1).content;
  assert.ok(answer.includes(`/drafts/${generatedId}`));
  assert.ok(!answer.includes("example.com"), "model-generated domains cannot replace the verified in-app draft path");
  assert.deepEqual(await files(["agent-chat.local.json"]), previous);
});
test("reading an approved historical draft retains its publication and metric records without writes", async () => {
  const current = (await call(`/api/content-drafts/${generatedId}`)).body.draft;
  assert.equal((await call(`/api/content-drafts/${generatedId}`, { reviewStatus: "approved", expectedUpdatedAt: current.updatedAt }, "PATCH")).status, 200);
  const publishedAt = "2026-10-09T02:00:00.000Z";
  const saved = await call(`/api/content-drafts/${generatedId}/publication`, { channel: "wechat_article", publishedAt, url: "https://example.com/flower-service", metrics: { views: 120, likes: 3 } });
  assert.equal(saved.status, 200);
  const previous = await files(["agent-chat.local.json"]);
  const turn = (await call("/api/agent/chat", { requestId: "publication-read", conversationId, content: "验收续聊：核对刚才这篇的人工审核和发布登记" })).body.turn;
  const completed = await waitTurn(turn.id, "completed");
  const draft = completed.tools.find((item) => item.name === "read_content").output;
  assert.equal(draft.reviewStatus, "approved");
  assert.deepEqual(draft.publications, saved.body.draft.publications);
  assert.equal(draft.publications[0].publishedAt, publishedAt);
  assert.equal(draft.publications[0].metrics.views, 120);
  assert.deepEqual(await files(["agent-chat.local.json"]), previous);
});
test("parallel model calls generate only one draft", async () => {
  const count = async () => (await (await fetch(`http://127.0.0.1:${port + 1}/draft-count`)).json()).count;
  const previous = await count();
  const turn = (await call("/api/agent/chat", { requestId: "parallel", conversationId, content: "验收写作 验收并行" })).body.turn;
  const completed = await waitTurn(turn.id, "completed");
  assert.equal(completed.tools.filter((item) => item.name === "create_draft").length, 1);
  assert.equal(await count(), previous + 1);
});
test("missing information waits for the user; foreign IDs and endless loops fail visibly", async () => {
  let response = await call("/api/agent/chat", { requestId: "ask", conversationId, content: "验收缺资料" });
  const waiting = await waitTurn(response.body.turn.id, "waiting_user");
  assert.match((await call("/api/agent/chat")).body.conversations[0].messages.at(-1).content, /选择/);
  assert.equal((await call(`/api/agent/chat/turns/${waiting.id}`, { action: "continue" })).status, 409);
  response = await call("/api/agent/chat", { requestId: "foreign", conversationId, content: "验收越权读取" });
  const failed = await waitTurn(response.body.turn.id, "failed");
  assert.match(failed.error, /当前账号/);
  response = await call("/api/agent/chat", { requestId: "ignored-tool-choice", conversationId, content: "验收忽略工具约束" });
  const ignored = await waitTurn(response.body.turn.id, "failed");
  assert.equal(ignored.tools.length, 0);
  assert.ok(ignored.error);
  assert.equal((await call("/api/agent/chat")).body.conversations.find((item) => item.id === conversationId).messages.at(-1).role, "user", "no assistant completion may be saved when required tools were ignored");
  response = await call("/api/agent/chat", { requestId: "loop", conversationId, content: "验收循环" });
  const loop = await waitTurn(response.body.turn.id, "failed");
  assert.equal(loop.steps, 6); assert.equal(loop.tools.length, 6);
  response = await call("/api/agent/chat", { requestId: "truncated", conversationId, content: "验收截断" });
  assert.match((await waitTurn(response.body.turn.id, "failed")).error, /未完整/);
});
test("a long current request retains the instructions at its end", async () => {
  const content = `${"资料".repeat(1750)}\n最后的要求：先别写作，验收缺资料`;
  const response = await call("/api/agent/chat", { requestId: "long-request", conversationId, content });
  await waitTurn(response.body.turn.id, "waiting_user");
  assert.equal((await call("/api/agent/chat")).body.conversations[0].messages.at(-2).content, content);
});
test("gateway failure retries the saved request and pause prevents subsequent tool execution", async () => {
  const response = await call("/api/agent/chat", { requestId: "retry", conversationId, content: "验收对话故障" });
  const failed = await waitTurn(response.body.turn.id, "failed");
  assert.equal((await call(`/api/agent/chat/turns/${failed.id}`, { action: "continue" })).status, 200);
  const resumed = await waitTurn(failed.id, "completed"); assert.equal(resumed.attempt, 2);
  const slow = (await call("/api/agent/chat", { requestId: "slow", conversationId, content: "验收慢任务" })).body.turn;
  assert.equal((await call(`/api/agent/chat/turns/${slow.id}`, { action: "pause" })).status, 200);
  await delay(1800);
  const paused = await waitTurn(slow.id, "paused"); assert.equal(paused.tools.length, 0);
  assert.equal((await call(`/api/agent/chat/turns/${slow.id}`, { action: "continue" })).status, 200);
  await waitTurn(slow.id, "completed");
});
test("a failure after saving a draft resumes without generating or overwriting it again", async () => {
  const count = async () => (await (await fetch(`http://127.0.0.1:${port + 1}/draft-count`)).json()).count;
  const response = await call("/api/agent/chat", { requestId: "saved-retry", conversationId, content: "验收写作 验收保存后故障" });
  const failed = await waitTurn(response.body.turn.id, "failed");
  const tool = failed.tools.find((item) => item.name === "create_draft");
  assert.equal(tool.status, "succeeded");
  const saved = (await call(`/api/content-drafts/${tool.output.projectId}`)).body.draft;
  const previous = await count();
  assert.equal((await call(`/api/agent/chat/turns/${failed.id}`, { action: "continue" })).status, 200);
  await waitTurn(failed.id, "completed");
  assert.equal(await count(), previous);
  assert.deepEqual((await call(`/api/content-drafts/${tool.output.projectId}`)).body.draft, saved);
});
test("restart retains full history and new conversation can retrieve earlier content", async () => {
  const before = (await call("/api/agent/chat")).body;
  await stop(app); app = start(".next/standalone/server.js"); await waitFor(`${base}/api/health`);
  assert.deepEqual((await call("/api/agent/chat")).body.conversations, before.conversations);
  const requested = (await call("/api/agent/chat", { requestId: "recall", content: "验收查旧内容" })).body.turn;
  const recalled = await waitTurn(requested.id, "completed");
  assert.ok(recalled.tools.find((item) => item.name === "search_content").output.projects.some((item) => item.id === generatedId));
  const history = (await call("/api/agent/chat", { requestId: "history", conversationId: requested.conversationId, content: "验收历史对话" })).body.turn;
  assert.ok((await waitTurn(history.id, "completed")).tools.find((item) => item.name === "search_conversation").output.messages.some((item) => item.content.includes("鲜花")));
  const original = await files();
  for (const url of ["/api/agent/chat", "/", `/drafts/${generatedId}`, "/articles"]) assert.equal((await fetch(base + url, { headers: { authorization } })).status, 200, url);
  assert.deepEqual(await files(), original, "reading legacy data and chat history never writes data");
});

function start(script) {
  const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child); child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; }); return child;
}
async function stop(child) { if (child.exitCode === null) { const exited = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; } }
async function call(url, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + url, { method, headers: { authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function waitTurn(id, status) {
  for (let index = 0; index < 200; index++) {
    const turn = (await call("/api/agent/chat")).body.turns.find((item) => item.id === id);
    if (turn?.status === status) return turn;
    if (turn?.status === "failed" && status !== "failed") throw new Error(`${JSON.stringify(turn)}\n${logs.slice(-5000)}`);
    await delay(100);
  }
  throw new Error(`Did not reach ${status}: ${logs.slice(-6000)}`);
}
async function waitFor(url) { for (let i = 0; i < 150; i++) { try { if ((await fetch(url)).ok) return; } catch {} await delay(100); } throw new Error(logs); }
async function files(exclude = []) { return Object.fromEntries(await Promise.all((await readdir(directory, { withFileTypes: true })).filter((item) => item.isFile() && item.name.endsWith(".json") && !exclude.includes(item.name)).map(async (item) => [item.name, (await readFile(path.join(directory, item.name))).toString("base64")]))); }
