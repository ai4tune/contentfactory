import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextBinary = process.env.NEXT_BIN || path.join(repositoryRoot, "node_modules/.bin/next");
const maintenanceScript = path.join(repositoryRoot, "ops/data-maintenance.mjs");
const port = Number(process.env.PERSISTENCE_TEST_PORT || 4331);
const baseUrl = `http://127.0.0.1:${port}`;
const authorization = `Basic ${Buffer.from("persistence:persistence-test-code").toString("base64")}`;

test("configured data survives restart and verified backup restore", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "contentfactory-persistence-"));
  const dataDir = path.join(root, "customer-data");
  const backupDir = path.join(root, "customer-backup");
  let app;
  let output = "";

  async function start() {
    app = spawn(nextBinary, ["start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        AI_BASE_URL: "http://127.0.0.1:9/v1",
        AI_API_KEY: "persistence-test-key",
        AI_MODEL: "persistence-test-model",
        CONTENT_FACTORY_ACCESS_USER: "persistence",
        CONTENT_FACTORY_ACCESS_CODE: "persistence-test-code",
        CONTENT_FACTORY_DATA_DIR: dataDir,
        UPLOADS_ENABLED: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.on("data", (chunk) => { output += chunk; });
    app.stderr.on("data", (chunk) => { output += chunk; });
    await waitForServer(app, () => output);
  }

  async function stop() {
    if (!app || app.exitCode !== null) return;
    const exited = once(app, "exit");
    app.kill("SIGTERM");
    await exited;
  }

  t.after(async () => {
    await stop();
    await rm(root, { recursive: true, force: true });
  });

  await start();
  const form = new FormData();
  form.append("files", new File(["持久化验证资料"], "persistence.md", { type: "text/markdown" }));
  const uploaded = await fetch(`${baseUrl}/api/uploads`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  assert.equal((await readMaterials()).length, 1);

  await stop();
  await start();
  assert.equal((await readMaterials())[0].title, "persistence.md");

  await stop();
  runMaintenance({ CONTENT_FACTORY_DATA_DIR: dataDir }, "backup", backupDir);
  runMaintenance({ CONTENT_FACTORY_DATA_DIR: dataDir }, "delete", "--confirm=DELETE_CUSTOMER_DATA");
  runMaintenance({ CONTENT_FACTORY_DATA_DIR: dataDir }, "restore", backupDir, "--confirm=RESTORE");

  await start();
  const restored = await readMaterials();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].text, "持久化验证资料");
});

async function readMaterials() {
  const response = await fetch(`${baseUrl}/api/materials`, {
    headers: { Authorization: authorization },
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  return JSON.parse(text).materials;
}

async function waitForServer(app, readOutput) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (app.exitCode !== null) throw new Error(`Test app exited early\n${readOutput()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for persistence test app\n${readOutput()}`);
}

function runMaintenance(env, ...args) {
  execFileSync(process.execPath, [maintenanceScript, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}
