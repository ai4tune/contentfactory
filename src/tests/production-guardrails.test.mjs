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
    "CONTENT_FACTORY_CAPTURE_TOKEN",
    "AI_API_KEY",
    "IMAGE_API_KEY",
    "FEISHU_APP_SECRET",
    "REDFOX_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CONTENT_FACTORY_WORKSPACE_ID",
  ]) {
    assert.match(example, new RegExp(`^${name}=$`, "m"));
  }
  assert.match(example, /^AI_REQUEST_TIMEOUT_MS=\d+$/m);
  assert.match(example, /^MARKET_REQUEST_TIMEOUT_MS=\d+$/m);
  assert.match(example, /^CONTENT_FACTORY_DATA_DIR=$/m);
  assert.match(example, /^CONTENT_FACTORY_BACKUP_DIR=$/m);
});

test("client bundles do not reference public secret environment variables", async () => {
  const files = await sourceFiles(path.join(repositoryRoot, "src"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_(?!SUPABASE_PUBLISHABLE_KEY)[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)/,
      file,
    );
  }
});

test("Supabase service-role persistence stays server-only and has a migration", async () => {
  const [admin, migration] = await Promise.all([
    readFile(path.join(repositoryRoot, "src/lib/supabase/admin.ts"), "utf8"),
    readFile(path.join(repositoryRoot, "supabase/migrations/202609200001_content_factory_cloud.sql"), "utf8"),
  ]);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY|supabaseServiceRoleKey/);
  assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_SERVICE/);
  assert.match(migration, /content_factory_workspace_members/);
  assert.match(migration, /content_factory_state/);
  assert.match(migration, /enable row level security/);
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

test("capture endpoints require credentials and never treat Origin as identity", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "src/modules/positioning/capture-access.ts"),
    "utf8",
  );
  assert.match(source, /const credentialValid = tokenValid/);
  assert.match(source, /corsAllowed && credentialValid/);
  assert.doesNotMatch(source, /const allowed = Boolean\(origin\).*sameOrigin/);
});

test("single-instance container uses standalone output and persistent volumes", async () => {
  const [nextConfig, dockerfile, compose] = await Promise.all([
    readFile(path.join(repositoryRoot, "next.config.ts"), "utf8"),
    readFile(path.join(repositoryRoot, "Dockerfile"), "utf8"),
    readFile(path.join(repositoryRoot, "docker-compose.yml"), "utf8"),
  ]);
  assert.match(nextConfig, /output:\s*["']standalone["']/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /CONTENT_FACTORY_DATA_DIR=\/app\/data/);
  assert.match(compose, /contentfactory-data:\/app\/data/);
  assert.match(compose, /contentfactory-backups:\/app\/backups/);
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
