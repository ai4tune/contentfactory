import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const serverRoot = process.env.INTERVIEW_RECOVERY_BASELINE_ROOT || root;
const port = Number(process.env.INTERVIEW_RECOVERY_TEST_PORT || 4511);
const headers = { authorization: `Basic ${Buffer.from("recovery:test-code").toString("base64")}`, "content-type": "application/json" };
const base = `http://127.0.0.1:${port}`;
const children = [];
const answers = { accountName: "恢复验证店", business: "花束制作", goal: "介绍花束服务", offer: "鲜花花束", audience: "", differentiator: "", boundaries: "", tone: "日常口语", primaryChannel: "wechat_article" };
let directory, state, logs = "";

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "contentfactory-interview-recovery-"));
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|CONTENT_FACTORY|AI_|IMAGE_|VISION_|FEISHU|WORKFLOW_/.test(key)));
  for (const [script, cwd, environment] of [
    ["src/tests/mock-ai-gateway.mjs", root, { MOCK_AI_PORT: String(port + 1) }],
    [".next/standalone/server.js", serverRoot, { HOSTNAME: "127.0.0.1", PORT: String(port), CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_USER: "recovery", CONTENT_FACTORY_ACCESS_CODE: "test-code", AI_BASE_URL: `http://127.0.0.1:${port + 1}/v1`, AI_API_KEY: "test-only", AI_MODEL: "acceptance-mock" }],
  ]) {
    const child = spawn(process.execPath, [path.join(cwd, script)], { cwd, env: { ...inherited, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child); child.stdout.on("data", chunk => { logs += chunk; }); child.stderr.on("data", chunk => { logs += chunk; });
    const url = script.startsWith("src") ? `http://127.0.0.1:${port + 1}/health` : base + "/api/health";
    for (let index = 0; index < 100; index++) { try { if ((await fetch(url)).ok) break; } catch {} if (index === 99) throw Error(logs); await delay(100); }
  }
  await call("/api/onboarding/status", { action: "start" }, "PATCH");
  state = (await call("/api/onboarding/interview")).data.interview;
});

after(async () => {
  for (const child of children.reverse()) if (child.exitCode === null) { const exited = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGTERM"); await exited; }
  if (directory) await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => { state = (await call("/api/onboarding/interview")).data.interview; });

test("recovery compares normalized answer values, independent of spaces and key order", async () => {
  const source = await readFile(path.join(root, "src/modules/onboarding/interview.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\n/gm, "");
  const { interviewAnswersMatch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const input = Object.fromEntries(Object.entries({ ...answers, accountName: " 恢复验证店 ", goal: "介绍花束服务\n" }).reverse());
  assert.notEqual(JSON.stringify(answers), JSON.stringify(input), "the original whole-object check rejects this valid saved answer");
  assert.equal(interviewAnswersMatch(answers, input), true);
  assert.equal(interviewAnswersMatch(answers, { ...input, industry: "general" }), true);
  for (const changed of [{ goal: "不同经营目标" }, { business: "不同业务" }, { primaryChannel: "xiaohongshu_note" }, { industry: "cafe" }]) assert.equal(interviewAnswersMatch(answers, { ...input, ...changed }), false);
});

test("an unusable AI result returns the saved revision and original answers for immediate retry", async () => {
  const input = Object.fromEntries(Object.entries({ ...answers, goal: " 验收访谈空方向 \n" }).reverse());
  const failed = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: input });
  assert.equal(failed.status, 500); assert.match(failed.data.error, /没有整理出可用的内容方向/);
  assert.ok(failed.data.interview, "failure must include the saved server revision");
  state = failed.data.interview; assert.equal(state.answers.goal, "验收访谈空方向"); assert.equal(state.step, 5); assert.equal(state.preview, null);
  assert.deepEqual((await call("/api/onboarding/interview")).data.interview, state, "another page can read the same saved draft");
  assert.equal((await call("/api/knowledge-profile/current")).data.confirmed, null);
  const retried = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers });
  assert.equal(retried.status, 200, JSON.stringify(retried.data)); state = retried.data.interview; assert.ok(state.preview);
});

test("transport failures also return saved answers, while stale requests never overwrite them", async () => {
  const failed = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: { ...answers, goal: "验收访谈失败" } });
  assert.equal(failed.status, 500); state = failed.data.interview; assert.ok(state);
  const before = await files();
  assert.equal((await call("/api/onboarding/interview", { action: "save", revision: state.revision - 1, step: 5, answers })).status, 409);
  assert.deepEqual(await files(), before);
});

test("readable object-based directions are normalized and remain unconfirmed suggestions", async () => {
  const result = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: { ...answers, goal: "验收访谈对象方向" } });
  assert.equal(result.status, 200, JSON.stringify(result.data)); state = result.data.interview;
  assert.deepEqual(state.preview.account.contentPillars, ["产品介绍：介绍本次真实服务", "到店场景"]);
  assert.equal((await call("/api/positioning/current")).data.context, null);
});

test("line-separated directions are usable without turning unknown data into facts", async () => {
  const result = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: { ...answers, goal: "验收访谈文本方向" } });
  assert.equal(result.status, 200, JSON.stringify(result.data)); state = result.data.interview;
  assert.deepEqual(state.preview.account.contentPillars, ["产品介绍", "到店场景", "日常经营"]);
  assert.equal((await call("/api/knowledge-profile/current")).data.confirmed, null);
});

test("save and exit reaches the overview, and returning to the interview keeps the last step", async () => {
  const saved = await call("/api/onboarding/interview", { action: "save", revision: state.revision, step: 5, answers });
  assert.equal(saved.status, 200); state = saved.data.interview;
  const before = await files(); const overview = await fetch(base + "/setup", { headers });
  assert.equal(overview.status, 200); const html = await overview.text();
  assert.ok(html.includes("继续聊经营，整理内容方向")); assert.ok(!html.includes('NEXT_REDIRECT;replace;/setup/interview'));
  const restored = (await call("/api/onboarding/interview")).data.interview;
  assert.equal(restored.step, 5); assert.deepEqual(restored.answers, answers);
  assert.deepEqual(await files(), before, "viewing saved answers and the overview must not write");
});

test("invalid and unauthenticated requests do not change saved answers", async () => {
  const before = await files();
  assert.equal((await fetch(base + "/api/onboarding/interview")).status, 401);
  const invalid = await call("/api/onboarding/interview", { action: "preview", revision: state.revision, answers: {} });
  assert.equal(invalid.status, 400); assert.equal(invalid.data.interview, undefined);
  assert.deepEqual(await files(), before);
});

async function call(url, body, method = body ? "POST" : "GET") { const response = await fetch(base + url, { headers, method, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
async function files() { return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async name => [name, (await readFile(path.join(directory, name))).toString("base64")]))); }
