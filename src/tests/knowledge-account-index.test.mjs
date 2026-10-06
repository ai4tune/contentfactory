import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { installLocalKnowledgeFixture } from "./fixtures/local-knowledge.mjs";

const source = (await readFile(new URL("../modules/knowledge/local-index.ts", import.meta.url), "utf8"))
  .replace(/from "(\.\/document-text|\.\/file-classification)"/g, (_, name) => `from "${new URL(`../modules/knowledge/${name.slice(2)}.ts`, import.meta.url).href}"`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const knowledge = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("local knowledge and cached folder handles follow the authenticated account", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid";
  let userId = "alice", authenticated = true;
  globalThis.fetch = async () => ({ ok: authenticated, json: async () => ({ workspaceId: userId }) });
  const alice = installLocalKnowledgeFixture();
  const aliceOpen = globalThis.indexedDB.open;
  const bob = installLocalKnowledgeFixture();
  for (const store of bob.stores.values()) store.clear();
  const bobOpen = globalThis.indexedDB.open;
  const opened = [];
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open(name) {
    opened.push(name);
    return name === "contentfactory-knowledge:alice" ? aliceOpen() : bobOpen();
  } } });
  try {
    assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
    await knowledge.readLocalKnowledgeItems([alice.records[0].id]);
    assert.equal(alice.state.reads, 1);
    userId = "bob";
    assert.deepEqual(await knowledge.loadLocalKnowledge(), []);
    await assert.rejects(knowledge.readLocalKnowledgeItems([alice.records[0].id]), /先选择知识库文件夹/);
    assert.equal(alice.state.reads, 1, "switching identity must not reuse the other account's folder");
    userId = "alice";
    assert.equal((await knowledge.loadLocalKnowledge()).length, 30);
    authenticated = false;
    await assert.rejects(knowledge.loadLocalKnowledge(), /先登录/);
    assert.ok(opened.every((name) => name !== "contentfactory-knowledge"), "the shared legacy index remains unread");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }
});
