import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("extension registers the bridge for the user-configured deployment origin", async () => {
  const [worker, popup] = await Promise.all([
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/service-worker.js"), "utf8"),
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/popup.js"), "utf8"),
  ]);
  assert.match(worker, /registerContentScripts/);
  assert.match(worker, /contentfactory-dynamic-bridge/);
  assert.match(popup, /contentfactory-register-origin/);
});
