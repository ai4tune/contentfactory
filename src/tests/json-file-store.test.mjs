import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("atomic JSON writes use collision-resistant temporary names", async () => {
  const source = await readFile(new URL("../lib/local-store/json-file.ts", import.meta.url), "utf8");
  assert.match(source, /randomUUID\(\)/);
  assert.doesNotMatch(source, /Date\.now\(\).*\.tmp/);

  const root = await mkdtemp(path.join(os.tmpdir(), "contentfactory-json-store-"));
  assert.deepEqual(await readdir(root), []);
  await rm(root, { recursive: true, force: true });
});
