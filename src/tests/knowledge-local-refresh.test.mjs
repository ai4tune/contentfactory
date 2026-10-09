import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { installLocalKnowledgeFixture } from "./fixtures/local-knowledge.mjs";

const source = (await readFile(new URL("../modules/knowledge/local-index.ts", import.meta.url), "utf8"))
  .replace(/from "(\.\/document-text|\.\/file-classification)"/g, (_, name) => `from "${new URL(`../modules/knowledge/${name.slice(2)}.ts`, import.meta.url).href}"`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const knowledge = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalWindow = globalThis.window;
globalThis.window = globalThis;
test.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });

test("refresh reads new and changed introductions, retains failed old records, and lists images without OCR", async () => {
  const fixture = installLocalKnowledgeFixture();
  // Establish a connection, then retain deliberately old metadata and unknown fields.
  await knowledge.chooseKnowledgeDirectory();
  const index = fixture.stores.get("local-index");
  const untouched = index.get(fixture.records[2].id);
  untouched.indexedAt = "2020-01-01T00:00:00.000Z";
  untouched.legacy = { owner: "isolated-customer", version: 7 };
  const before = structuredClone({ ...untouched, handle: undefined });
  let bodyReads = 0;
  for (const record of fixture.records) {
    const getFile = record.handle.getFile;
    record.handle.getFile = async () => {
      const file = await getFile();
      file.slice = () => ({ text: async () => { bodyReads += 1; throw new Error("unchanged files must not be read"); } });
      return file;
    };
  }
  fixture.records[0].handle.getFile = async () => new File(["更新的企业简介"], fixture.records[0].path, { lastModified: 999 });
  const failed = { ...index.get(fixture.records[1].id) };
  fixture.records[1].handle.getFile = async () => { throw new Error("文件暂未下载"); };
  const added = new File(["新增企业简介"], "新简介.txt", { lastModified: 1000 });
  const image = new File(["isolated image"], "产品.png", { lastModified: 1001 });
  image.arrayBuffer = async () => { throw new Error("scanning must not read image bytes"); };
  const entries = [...fixture.records.map((r) => [r.path, r.handle]),
    [added.name, { kind: "file", getFile: async () => added }],
    [image.name, { kind: "file", getFile: async () => image }]];
  fixture.root.entries = async function* () { yield* entries; };
  const result = await knowledge.refreshStoredDirectory();
  assert.equal(bodyReads, 0);
  assert.equal(result.items.length, 32);
  assert.equal(result.report.addedFiles, 2);
  assert.equal(result.report.updatedFiles, 1);
  assert.equal(result.report.reusedFiles, 28);
  assert.equal(result.report.retainedFiles, 1);
  assert.equal(result.report.failedFiles[0].path, failed.path);
  assert.match(result.items.find((r) => r.id === fixture.records[0].id).searchText, /更新的企业简介/);
  assert.equal(result.items.find((r) => r.path === image.name).needsRecognition, true);
  assert.deepEqual({ ...index.get(untouched.id), handle: undefined }, before);
  assert.deepEqual(index.get(failed.id), failed);
});

test("choosing another folder never reuses matching names from the old folder", async () => {
  const fixture = installLocalKnowledgeFixture();
  const file = new File(["另一个账号资料"], fixture.records[0].path, { lastModified: fixture.records[0].lastModified });
  globalThis.showDirectoryPicker = async () => ({ ...fixture.root, async *entries() { yield [file.name, { kind: "file", getFile: async () => file }]; } });
  const result = await knowledge.chooseKnowledgeDirectory();
  assert.equal(result.report.reusedFiles, 0);
  assert.match(result.items[0].searchText, /另一个账号资料/);
});

test("opening legacy local indexes preserves all fields with zero writes or body reads", async () => {
  const fixture = installLocalKnowledgeFixture();
  fixture.records[0].legacy = { version: 7, owner: "isolated-customer" };
  fixture.records[0].indexedAt = "2020-01-01T00:00:00Z";
  const result = await knowledge.loadLocalKnowledge();
  assert.deepEqual(result[0].legacy, fixture.records[0].legacy);
  assert.equal(result[0].indexedAt, fixture.records[0].indexedAt);
  assert.equal(fixture.state.writes, 0);
  assert.equal(fixture.state.reads, 0);
});
