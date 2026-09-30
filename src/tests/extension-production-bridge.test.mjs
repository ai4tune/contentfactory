import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("extension registers the bridge for the user-configured deployment origin", async () => {
  const [worker, popup, bridge, manifestText] = await Promise.all([
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/service-worker.js"), "utf8"),
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/popup.js"), "utf8"),
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/bridge.js"), "utf8"),
    readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/manifest.json"), "utf8"),
  ]);
  assert.match(worker, /registerContentScripts/);
  assert.match(worker, /contentfactory-dynamic-bridge/);
  assert.match(popup, /contentfactory-register-origin/);
  assert.match(bridge, /authorize/);
  assert.match(bridge, /chrome\.storage\.local\.set/);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.version, "0.9.0");
  assert.ok(manifest.content_scripts.some((entry) => entry.matches.includes("https://nrgc.xingren.me/*")));
});

test("extension bridge stores one-click authorization for the current site only", async () => {
  const bridge = await readFile(
    path.join(repositoryRoot, "extensions/contentfactory-capture/bridge.js"),
    "utf8",
  );
  const stored = {};
  const messages = [];
  const listeners = new Map();
  const window = {
    location: { origin: "https://nrgc.xingren.me" },
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage(message) { messages.push(message); },
  };
  const chrome = {
    runtime: { getManifest: () => ({ version: "0.9.0" }) },
    storage: {
      local: {
        async get(defaults) { return { ...defaults, ...stored }; },
        async set(values) { Object.assign(stored, values); },
      },
    },
  };
  vm.runInNewContext(bridge, { chrome, URL, window });
  await tick();

  listeners.get("message")({
    source: window,
    data: {
      source: "contentfactory-positioning-page",
      type: "authorize",
      requestId: "request-1",
      token: "capture-token",
      baseUrl: "https://nrgc.xingren.me/positioning",
    },
  });
  await tick();

  assert.deepEqual(stored, {
    baseUrl: "https://nrgc.xingren.me",
    accessToken: "capture-token",
  });
  assert.ok(messages.some((message) => (
    message.type === "authorization-complete"
    && message.requestId === "request-1"
    && message.authorized === true
  )));
});

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}
