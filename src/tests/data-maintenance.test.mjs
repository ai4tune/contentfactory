import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(repositoryRoot, "ops/data-maintenance.mjs");

test("customer data can be backed up, verified, restored and deleted", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "contentfactory-data-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backup");
  await mkdir(dataDir);
  await writeFile(path.join(dataDir, "contentfactory.local.json"), '{"version":1}\n');

  run("backup", backupDir, `--data-dir=${dataDir}`);
  const manifest = JSON.parse(await readFile(path.join(backupDir, "manifest.json"), "utf8"));
  assert.equal(manifest.version, 1);
  assert.ok(manifest.files["contentfactory.local.json"]);

  await writeFile(path.join(dataDir, "contentfactory.local.json"), '{"version":2}\n');
  run("restore", backupDir, "--confirm=RESTORE", `--data-dir=${dataDir}`);
  assert.equal(await readFile(path.join(dataDir, "contentfactory.local.json"), "utf8"), '{"version":1}\n');

  run("delete", "--confirm=DELETE_CUSTOMER_DATA", `--data-dir=${dataDir}`);
  await assert.rejects(readFile(path.join(dataDir, "contentfactory.local.json"), "utf8"));
  await rm(root, { recursive: true, force: true });
});

test("destructive commands require an explicit confirmation phrase", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "contentfactory-confirm-"));
  assert.throws(() => run("delete", `--data-dir=${path.join(root, "data")}`));
  assert.throws(() => run("restore", root, `--data-dir=${path.join(root, "data")}`));
  await rm(root, { recursive: true, force: true });
});

test("data and backup environment directories are honored", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "contentfactory-env-data-"));
  const dataDir = path.join(root, "customer-data");
  const backupDir = path.join(root, "customer-backups");
  await mkdir(dataDir);
  await writeFile(path.join(dataDir, "onboarding.local.json"), '{"version":1}\n');

  const output = runWithEnv(
    { CONTENT_FACTORY_DATA_DIR: dataDir, CONTENT_FACTORY_BACKUP_DIR: backupDir },
    "backup",
  );
  const createdPath = output.trim().replace(/^备份完成：/, "");
  const manifest = JSON.parse(await readFile(path.join(createdPath, "manifest.json"), "utf8"));
  assert.ok(manifest.files["onboarding.local.json"]);
  assert.equal(path.dirname(createdPath), backupDir);
  await rm(root, { recursive: true, force: true });
});

function run(...args) {
  return runWithEnv({}, ...args);
}

function runWithEnv(env, ...args) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "pipe",
  });
}
