import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../modules/agent/chat/research-policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { canCorrectPlaceReference, externalAttempts, webAttempts, webQueryLimit } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("explicit web budgets recognize common count wording and do not count stores or result items", () => {
  for (const [request, expected] of [
    ["用一次网页搜索找官方账号", 1], ["网页搜索最多两次", 2], ["只进行３次联网搜索", 3],
    ["Brave最多1次", 1], ["one web search", 1], ["at most 2 web searches", 2],
    ["十二次网页搜索", 4], ["不用联网搜索", 0], ["网页搜索0次", 0],
    ["一次网页搜索，网页搜索最多两次", 1],
    ["查附近3家店，网页搜索取8条结果", undefined], ["第一次用，帮我联网搜索", undefined],
    ["这是第一次网页搜索的记录", undefined], ["至少两次网页搜索", undefined],
  ]) assert.equal(webQueryLimit(request), expected, request);
});

test("legacy checkpoint budgets are interpreted without mutating old records", () => {
  const records = [
    { name: "search_web", status: "succeeded", output: { research: { id: "saved" } }, legacy: "keep" },
    { name: "search_web", status: "failed", errorStatus: 502 },
    { name: "search_web", status: "failed", errorStatus: 503 },
    { name: "read_place", status: "failed", errorStatus: 400 },
  ];
  const before = structuredClone(records);
  assert.equal(webAttempts(records), 2);
  assert.equal(externalAttempts(records[3]), 0);
  assert.deepEqual(records, before);
});

test("legacy ordinal recovery requires an owned record and never masks a failed real source", () => {
  const research = [{ id: "research_own", sources: [{ id: "research_own:source:valid" }] }];
  const failed = { name: "read_place", status: "failed", input: { sourceId: "research_own:source:0" } };
  assert.equal(canCorrectPlaceReference(failed, research), true);
  assert.equal(canCorrectPlaceReference({ ...failed, input: { sourceId: "research_foreign:source:0" } }, research), false);
  assert.equal(canCorrectPlaceReference({ ...failed, input: { sourceId: "research_own:source:valid" } }, research), false);
  assert.equal(canCorrectPlaceReference({ ...failed, errorStatus: 502 }, research), false);
});
