import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const port = Number(process.env.KNOWLEDGE_TASK_TEST_PORT || 4349);
const baseUrl = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("tasks:tasks-access").toString("base64")}`;
let directory, app, gateway, gatewayPort, logs = "", rejectBroken = true;
const calls = { normal: 0, broken: 0, merged: 0, organization: 0 };

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "knowledge-tasks-"));
  gateway = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const messages = JSON.parse(body).messages;
    const content = messages.at(-1).content;
    const organization = messages[0].content.includes("summary 和 assignments");
    const merged = content.includes("多批资料");
    const broken = content.includes("[broken]");
    const key = organization ? "organization" : merged ? "merged" : broken ? "broken" : "normal";
    calls[key]++;
    await delay(2_500);
    response.setHeader("Content-Type", "application/json");
    if (broken && rejectBroken) {
      response.writeHead(504);
      response.end(JSON.stringify({ error: { message: "The operation was aborted due to timeout" } }));
      return;
    }
    const sourceIds = merged ? ["a", "b", "broken"] : Array.from(content.matchAll(/\[([^\]]+)\]/g), (match) => match[1]);
    const result = organization ? {
      summary: "目录建议", assignments: [{ sourceId: "folder-source", folderId: "brand", reason: "企业介绍" }],
    } : {
      name: "杏仁任务验收档案", businessSummary: "企业 AI 内容服务", targetCustomers: [], offers: [], strengths: [], businessGoals: [], preferredTopics: [], forbiddenClaims: [], gaps: [],
      facts: [{ category: "业务", statement: "提供企业 AI 内容服务", confidence: "confirmed", sourceIds }],
    };
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  gatewayPort = gateway.address().port;
  await startApp();
});

after(async () => {
  await stopApp();
  gateway?.closeAllConnections();
  await new Promise((resolve) => gateway?.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("background knowledge tasks preserve progress and recover independently of the browser", { timeout: 120_000 }, async (t) => {
  await t.test("task endpoints require authentication and validate input", async () => {
    assert.equal((await fetch(`${baseUrl}/api/knowledge/tasks`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/knowledge/tasks`, { method: "POST", body: "{}" })).status, 401);
    assert.equal((await request("/api/knowledge/tasks", { kind: "unknown", sources: [] })).status, 400);
    assert.equal((await request("/api/knowledge/tasks", { kind: "profile", sources: Array(31).fill({}) })).status, 400);
  });
  let taskId;
  await t.test("submission returns before AI finishes and rejects duplicate active tasks", async () => {
    const sources = ["a", "b", "broken"].map((id) => ({ id, title: id, source: "local", text: "企业 AI 内容服务".repeat(1_000) }));
    const started = Date.now();
    const response = await request("/api/knowledge/tasks", { kind: "profile", sources });
    assert.equal(response.status, 202, await response.clone().text());
    assert.ok(Date.now() - started < 2_500, "submission must not wait for the AI response");
    const { task } = await response.json();
    taskId = task.id;
    assert.equal(task.totalBatches, 2);
    assert.ok(task.estimatedMinutes.max >= task.estimatedMinutes.min);
    assert.equal((await request("/api/knowledge/tasks", { kind: "profile", sources })).status, 409);
  });
  await t.test("without client polling, successful batches remain saved after automatic retries fail", async () => {
    await delay(32_000);
    const task = await waitForTask(taskId, "failed");
    assert.equal(task.completedBatches, 1);
    assert.equal(calls.normal, 1);
    assert.equal(calls.broken, 3);
    assert.match(task.error, /重试/);
    assert.doesNotMatch(JSON.stringify(task), /The operation|企业 AI 内容服务|sources|batches|compiledProfile/);
  });
  await t.test("manual retry only reruns the failed batch and saves a draft", async () => {
    rejectBroken = false;
    assert.equal((await request(`/api/knowledge/tasks/${taskId}/retry`, {})).status, 202);
    const task = await waitForTask(taskId, "succeeded");
    assert.equal(task.attempt, 2);
    assert.equal(calls.normal, 1);
    assert.equal(calls.broken, 4);
    const profiles = JSON.parse(await readFile(path.join(directory, "enterprise-knowledge-profiles.local.json"), "utf8"));
    assert.equal(profiles.profiles.length, 1);
    assert.equal(profiles.profiles[0].id, task.profileId);
    assert.equal(profiles.profiles[0].status, "draft");
    assert.deepEqual(profiles.profiles[0].facts[0].sourceIds, ["a", "b", "broken"]);
    const store = JSON.parse(await readFile(path.join(directory, "knowledge-tasks.local.json"), "utf8"));
    assert.equal(store.tasks[0].sources, undefined);
    assert.deepEqual(store.tasks[0].batches, {});
    assert.equal(store.tasks[0].compiledProfile, undefined);
  });
  await t.test("a new client can retrieve a directory plan after the submitting client leaves", async () => {
    const response = await request("/api/knowledge/tasks", { kind: "organization", sources: [{ id: "folder-source", title: "企业介绍", source: "local", text: "企业 AI 内容服务" }] });
    assert.equal(response.status, 202);
    const { task } = await response.json();
    await delay(5_000);
    const finished = await waitForTask(task.id, "succeeded");
    assert.deepEqual(finished.plan.assignments, [{ sourceId: "folder-source", folderId: "brand", reason: "企业介绍" }]);
    assert.equal(calls.organization, 1);
  });
  await t.test("persisted status and results survive a server restart", async () => {
    await stopApp();
    await startApp();
    const response = await request("/api/knowledge/tasks");
    const { tasks } = await response.json();
    assert.equal(tasks.find((task) => task.id === taskId).status, "succeeded");
    assert.ok(tasks[0].plan);
  });
});

test("timeout details are translated and configuration errors are not retried", async () => {
  const source = await readFile(new URL("../modules/knowledge/tasks/errors.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const errors = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  assert.match(errors.knowledgeTaskError(new DOMException("The operation was aborted due to timeout", "TimeoutError")), /超时/);
  assert.equal(errors.canRetryKnowledgeError(Object.assign(new Error("unauthorized"), { code: "HTTP_401" })), false);
  assert.equal(errors.canRetryKnowledgeError(Object.assign(new Error("unavailable"), { code: "HTTP_503" })), true);
});

async function request(url, body) {
  return fetch(`${baseUrl}${url}`, { method: body === undefined ? "GET" : "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function waitForTask(id, status) {
  const deadline = Date.now() + 45_000;
  let task;
  while (Date.now() < deadline) {
    const response = await request("/api/knowledge/tasks");
    const payload = await response.json();
    task = payload.tasks?.find((item) => item.id === id);
    if (task?.status === status) return task;
    await delay(300);
  }
  throw new Error(`Task did not become ${status}: ${JSON.stringify(task)}\n${logs.slice(-5000)}`);
}

async function startApp() {
  app = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env: {
    ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port),
    AI_BASE_URL: `http://127.0.0.1:${gatewayPort}/v1`, AI_API_KEY: "task-test", AI_MODEL: "task-test",
    CONTENT_FACTORY_ACCESS_USER: "tasks", CONTENT_FACTORY_ACCESS_CODE: "tasks-access", CONTENT_FACTORY_DATA_DIR: directory,
    WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", CONTENT_FACTORY_WORKSPACE_ID: "",
  }, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", (chunk) => { logs += chunk; });
  app.stderr.on("data", (chunk) => { logs += chunk; });
  for (let index = 0; index < 100; index++) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch { /* Wait for readiness. */ }
    await delay(200);
  }
  throw new Error(`Server failed to start: ${logs}`);
}

async function stopApp() {
  if (!app || app.exitCode !== null) return;
  const exited = new Promise((resolve) => app.once("exit", resolve));
  app.kill("SIGTERM");
  await exited;
}
