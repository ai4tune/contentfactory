import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("example environment contains deployment guardrails without real secrets", async () => {
  const example = await readFile(path.join(repositoryRoot, ".env.example"), "utf8");
  for (const name of [
    "CONTENT_FACTORY_ACCESS_CODE",
    "AI_API_KEY",
    "IMAGE_API_KEY",
    "FEISHU_APP_SECRET",
    "REDFOX_API_KEY",
  ]) {
    assert.match(example, new RegExp(`^${name}=$`, "m"));
  }
  assert.match(example, /^AI_REQUEST_TIMEOUT_MS=\d+$/m);
  assert.match(example, /^MARKET_REQUEST_TIMEOUT_MS=\d+$/m);
});

test("client bundles do not reference public secret environment variables", async () => {
  const files = await sourceFiles(path.join(repositoryRoot, "src"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)/, file);
  }
});

test("production access middleware protects application routes and leaves health public", async () => {
  const source = await readFile(path.join(repositoryRoot, "src/middleware.ts"), "utf8");
  assert.match(source, /CONTENT_FACTORY_ACCESS_CODE/);
  assert.match(source, /NODE_ENV !== "production"/);
  assert.match(source, /WWW-Authenticate/);
  assert.match(source, /api\/health/);
  assert.match(source, /api\/capture/);
  assert.match(source, /api\/topics\/search-plan/);
});

test("market requests have bounded timeouts and stale-cache degradation", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "src/modules/market/providers/redfox-provider.ts"),
    "utf8",
  );
  assert.match(source, /MARKET_REQUEST_TIMEOUT_MS/);
  assert.match(source, /STALE_CACHE_FALLBACK/);
  assert.match(source, /if \(cached\)/);
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}
