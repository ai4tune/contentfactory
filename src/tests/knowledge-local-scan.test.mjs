import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { installLocalKnowledgeFixture } from "./fixtures/local-knowledge.mjs";

const source = (await readFile(new URL("../modules/knowledge/local-index.ts", import.meta.url), "utf8"))
  .replace(/from "(\.\/document-text|\.\/file-classification)"/g, (_, name) => `from "${new URL(`../modules/knowledge/${name.slice(2)}.ts`, import.meta.url).href}"`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const knowledge = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

// Exercise actual timeout paths quickly; no user files or browser prompts are used.
const originalTimeout = AbortSignal.timeout;
const originalWindow = globalThis.window;
AbortSignal.timeout = () => originalTimeout(50);
globalThis.window = globalThis;
const keepAlive = setInterval(() => {}, 100);
test.after(() => {
  AbortSignal.timeout = originalTimeout;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  clearInterval(keepAlive);
});

function chooseRoot(fixture, entries) {
  const root = { ...fixture.root, async *entries() { yield* entries; } };
  globalThis.showDirectoryPicker = async () => root;
  return root;
}

function file(name, getFile) { return [name, { kind: "file", name, getFile }]; }

test("one hung file cannot block later material, and unreadable files are reported", async () => {
  const fixture = installLocalKnowledgeFixture();
  const good = fixture.records[0];
  chooseRoot(fixture, [
    file("未下载.pdf", () => new Promise(() => {})),
    [good.path, good.handle],
    file("损坏.docx", async () => { throw new Error("文件无法打开"); }),
    file("介绍.pptx", () => { throw new Error("PPT must be skipped without reading"); }),
    file("菜单.jpg", () => { throw new Error("Image must be skipped without reading"); }),
  ]);
  const progress = [];
  const snapshot = await knowledge.chooseKnowledgeDirectory({ onProgress: (value) => progress.push(value) });
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.report.totalFiles, 5);
  assert.equal(snapshot.report.skippedFiles, 4);
  assert.equal(snapshot.report.imageFiles, 1);
  assert.deepEqual(snapshot.report.failedFiles.map(({ path }) => path), ["未下载.pdf", "损坏.docx"]);
  assert.match(snapshot.report.failedFiles[0].reason, /超过 15 秒/);
  assert.ok(progress.some((value) => value.phase === "reading" && value.currentPath === "未下载.pdf"));
  assert.ok(progress.some((value) => value.currentPath === good.path));
  assert.deepEqual(progress.at(-1), { phase: "saving", checkedFiles: 5, indexedFiles: 1, skippedFiles: 4 });
  assert.equal((await knowledge.loadLocalKnowledge()).length, 1);
});

test("stopping a new scan preserves the previous folder handle and complete index", async () => {
  const fixture = installLocalKnowledgeFixture();
  chooseRoot(fixture, [file("slow.pdf", async () => { throw new DOMException("Read aborted", "AbortError"); })]);
  const controller = new AbortController();
  await assert.rejects(knowledge.chooseKnowledgeDirectory({
    signal: controller.signal,
    onProgress: (progress) => { if (progress.phase === "reading") controller.abort(); },
  }), (error) => error.name === "AbortError");
  assert.equal(fixture.stores.get("handles").get("root-directory"), fixture.root);
  assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
});

test("a stalled directory produces an actionable error without replacing the old index", async () => {
  const fixture = installLocalKnowledgeFixture();
  globalThis.showDirectoryPicker = async () => ({ ...fixture.root, entries: () => ({ next: () => new Promise(() => {}) }) });
  await assert.rejects(knowledge.chooseKnowledgeDirectory(), /无法读取目录.*已下载到电脑/);
  assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
});

test("reopening the knowledge page restores cached items without re-reading the folder", async () => {
  const fixture = installLocalKnowledgeFixture();
  await knowledge.chooseKnowledgeDirectory();
  fixture.state.reads = 0;
  const restored = await knowledge.reconnectKnowledgeDirectory();
  assert.equal(restored.items.length, 30);
  assert.equal(fixture.state.reads, 0);
});

test("login session checks time out before touching local files", async () => {
  const fixture = installLocalKnowledgeFixture();
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid";
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  try {
    await assert.rejects(knowledge.chooseKnowledgeDirectory(), /登录状态校验超时/);
    assert.equal(fixture.state.reads, 0);
    assert.equal(fixture.stores.get("local-index").size, 30);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }
});

test("a blocked IndexedDB upgrade gives recovery instructions", async () => {
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open() {
    const pending = {};
    queueMicrotask(() => pending.onblocked());
    return pending;
  } } });
  await assert.rejects(knowledge.loadLocalKnowledge(), /关闭其他标签页/);
});
