import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const port = 4389, aiPort = 4390, base = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("knowledge:isolated-test").toString("base64")}`;
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zs7sAAAAASUVORK5CYII=";
let app, gateway, directory, calls = 0, mode = "success", logs = "";
const old = { id: "upload:旧简介.txt:9", title: "旧简介.txt", source: "upload", text: "旧用户资料", createdAt: "2020-01-01T00:00:00Z", legacy: { version: 7, owner: "isolated-owner" } };
const seed = { materials: [old], legacyRoot: { owner: "isolated-owner", version: 42 } };
async function request(url, body, auth = true) {
  return fetch(`${base}${url}`, { method: body === undefined ? "GET" : "POST", headers: { ...(auth ? { Authorization: authorization } : {}), "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "knowledge-import-"));
  await writeFile(path.join(directory, "contentfactory.local.json"), JSON.stringify(seed));
  gateway = createServer(async (req, res) => {
    let text = ""; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    calls += 1;
    assert.equal(body.model, "isolated-vision-model");
    assert.ok(body.messages[1].content.some((part) => part.type === "image_url" && part.image_url.url === image));
    if (mode === "error") { res.writeHead(503); return res.end(JSON.stringify({ error: { message: "isolated unavailable" } })); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: mode === "empty" ? "" : "隔离图片简介，待核对" }) } }] }));
  });
  await new Promise((resolve) => gateway.listen(aiPort, "127.0.0.1", resolve));
  app = spawn(process.execPath, [".next/standalone/server.js"], { cwd: root, env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", CONTENT_FACTORY_DATA_DIR: directory,
    NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", AI_BASE_URL: `http://127.0.0.1:${aiPort}/v1`, AI_API_KEY: "isolated-key", AI_MODEL: "isolated-text-only-model",
    VISION_BASE_URL: `http://127.0.0.1:${aiPort}/v1`, VISION_API_KEY: "isolated-vision-key", VISION_MODEL: "isolated-vision-model",
    CONTENT_FACTORY_ACCESS_USER: "knowledge", CONTENT_FACTORY_ACCESS_CODE: "isolated-test", UPLOADS_ENABLED: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", (x) => logs += x); app.stderr.on("data", (x) => logs += x);
  for (let tries = 0; tries < 100; tries += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(logs);
});
after(async () => { if (app) { app.kill("SIGTERM"); await new Promise((resolve) => app.once("exit", resolve)); } if (gateway) await new Promise((resolve) => gateway.close(resolve)); if (directory) await rm(directory, { recursive: true, force: true }); });

test("old uploads remain discoverable and readable with zero writes", async () => {
  const file = path.join(directory, "contentfactory.local.json");
  const before = await readFile(file, "utf8"), metadata = await stat(file);
  const result = await request("/api/materials");
  assert.deepEqual((await result.json()).materials[0], old);
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal((await stat(file)).mtimeMs, metadata.mtimeMs);
});
test("recognition requires authentication and rejects remote URLs before contacting AI", async () => {
  assert.equal((await request("/api/knowledge/recognize", { image }, false)).status, 401);
  for (const invalid of ["https://example.com/private.png", "data:image/svg+xml;base64,PHN2Zz4=", image + "!", "data:image/png;base64," + "a".repeat(2_000_000)]) {
    assert.equal((await request("/api/knowledge/recognize", { image: invalid })).status, 400);
  }
  assert.equal(calls, 0);
});
test("recognition sends real image blocks and reports empty or unavailable results", async () => {
  const good = await request("/api/knowledge/recognize", { image });
  assert.equal(good.status, 200); assert.match((await good.json()).text, /隔离图片简介/);
  mode = "empty"; assert.equal((await request("/api/knowledge/recognize", { image })).status, 422);
  mode = "error"; const failed = await request("/api/knowledge/recognize", { image });
  assert.equal(failed.status, 502); assert.match((await failed.json()).error, /503/);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, "contentfactory.local.json"), "utf8")), seed, "recognition never saves material or replaces the knowledge profile");
});
test("extracted PDF/Word text imports independently while preserving old timestamps, owner and unknown fields", async () => {
  for (const body of [{ name: "bad.pdf", size: 1, text: "" }, { name: "bad.pdf", size: -1, text: "bad" }, { name: "bad.pdf", size: 1, text: "a".repeat(128_001) }]) assert.equal((await request("/api/uploads", body)).status, 400);
  const imported = await request("/api/uploads", { name: "新简介.pdf", size: 9_000_000, text: "本机提取的企业简介" });
  assert.equal(imported.status, 200);
  assert.match((await imported.json()).sources[0].text, /本机提取/);
  let store = JSON.parse(await readFile(path.join(directory, "contentfactory.local.json"), "utf8"));
  assert.deepEqual(store.materials[0], old); assert.deepEqual(store.legacyRoot, seed.legacyRoot);
  assert.equal((await request("/api/uploads", { name: "旧简介.txt", size: 9, text: "用户主动更新的简介" })).status, 200);
  store = JSON.parse(await readFile(path.join(directory, "contentfactory.local.json"), "utf8"));
  assert.equal(store.materials[0].createdAt, old.createdAt); assert.deepEqual(store.materials[0].legacy, old.legacy);
  assert.equal(store.materials[0].text, "用户主动更新的简介");
});
test("legacy multipart text imports remain supported", async () => {
  const form = new FormData(); form.append("files", new File(["旧上传协议"], "兼容.txt"));
  const result = await fetch(`${base}/api/uploads`, { method: "POST", headers: { Authorization: authorization }, body: form });
  assert.equal(result.status, 200); assert.equal((await result.json()).sources[0].text, "旧上传协议");
});
