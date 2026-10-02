import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { installLocalKnowledgeFixture } from "./fixtures/local-knowledge.mjs";

const source = (await readFile(new URL("../modules/knowledge/local-index.ts", import.meta.url), "utf8"))
  .replace(/from "(\.\/document-text|\.\/file-classification)"/g, (_, name) =>
    `from "${new URL(`../modules/knowledge/${name.slice(2)}.ts`, import.meta.url).href}"`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const knowledge = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("local knowledge permissions are checked once and restored explicitly", async (t) => {
  const fixture = installLocalKnowledgeFixture();
  const { state, records } = fixture;
  const ids = records.map((record) => record.id);
  await t.test("30 selected documents use one folder check and no implicit prompts", async () => {
    const result = await knowledge.readLocalKnowledgeItems(ids);
    assert.equal(result.length, 30);
    assert.equal(state.checks, 1);
    assert.equal(state.requests, 0);
    assert.equal(state.reads, 30);
    assert.match(result[29].text, /测试正文 29/);
  });
  await t.test("expired permission preserves the index and does not read any files", async () => {
    state.permission = "prompt";
    const before = state.reads;
    await assert.rejects(knowledge.readLocalKnowledgeItems(ids), (error) => {
      assert.ok(error instanceof knowledge.KnowledgeDirectoryPermissionError);
      assert.equal(error.permission, "prompt");
      assert.match(error.message, /已选资料仍保留/);
      return true;
    });
    assert.equal(state.requests, 0);
    assert.equal(state.reads, before);
    assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
  });
  await t.test("denial keeps recovery available; successful recovery can retry all 30", async () => {
    state.grant = "denied";
    const denied = knowledge.requestStoredDirectoryPermission();
    assert.equal(state.requests, 1, "request starts synchronously with the user's click");
    await assert.rejects(denied, (error) => error.permission === "denied");
    assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
    state.grant = "granted";
    const restored = await knowledge.requestStoredDirectoryPermission();
    assert.equal(restored.items.length, 30);
    assert.deepEqual(restored.items.map((item) => item.id).sort(), [...ids].sort());
    const before = state.checks;
    assert.equal((await knowledge.readLocalKnowledgeItems(ids)).length, 30);
    assert.equal(state.checks, before + 1);
  });
  await t.test("permission lost during file access produces a recoverable folder error", async () => {
    state.failRead = true;
    await assert.rejects(knowledge.readLocalKnowledgeItem(ids[0]), knowledge.KnowledgeDirectoryPermissionError);
    state.failRead = false;
  });
  await t.test("remote-only selections do not need a local folder", async () => {
    await knowledge.disconnectKnowledgeDirectory();
    assert.deepEqual(await knowledge.readLocalKnowledgeItems([]), []);
    await assert.rejects(knowledge.readLocalKnowledgeItem(ids[0]), /先选择知识库文件夹/);
  });
});
