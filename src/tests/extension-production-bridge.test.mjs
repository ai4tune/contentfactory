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
  assert.equal(manifest.version, "0.9.1");
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
    runtime: { getManifest: () => ({ version: "0.9.1" }) },
    storage: {
      onChanged: { addListener() {} },
      local: {
        async get(defaults) { return { ...defaults, ...stored }; },
        async set(values) { Object.assign(stored, values); },
      },
    },
  };
  const fetch = async (url, options) => {
    assert.equal(url, "https://nrgc.xingren.me/api/capture/status");
    assert.equal(options.credentials, "include");
    assert.equal(JSON.parse(options.body).token, "capture-token");
    return { ok: true, async json() { return { authorized: true }; } };
  };
  vm.runInNewContext(bridge, { chrome, URL, window, fetch, AbortSignal });
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
    && message.authorizationChecked === true
  )));
});

test("stored token is not authorization until the server confirms it for the logged-in account", async () => {
  const bridge = await readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/bridge.js"), "utf8");
  const stored = { baseUrl: "https://nrgc.xingren.me", accessToken: "legacy-token" };
  const messages = [], listeners = new Map();
  let storageChange, authorized = false, checks = 0;
  const window = {
    location: { origin: stored.baseUrl },
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage(message) { messages.push(message); },
  };
  const chrome = {
    runtime: { getManifest: () => ({ version: "0.9.1" }) },
    storage: {
      local: { async get(defaults) { return { ...defaults, ...stored }; }, async set(values) { Object.assign(stored, values); } },
      onChanged: { addListener(listener) { storageChange = listener; } },
    },
  };
  const fetch = async () => { checks++; return { ok: true, async json() { return { authorized, error: authorized ? undefined : "授权已失效" }; } }; };
  vm.runInNewContext(bridge, { chrome, URL, window, fetch, AbortSignal });
  await tick();
  assert.equal(messages.at(-1).authorized, false);
  assert.equal(messages.at(-1).authorizationChecked, true);
  listeners.get("message")({ source: window, data: { source: "contentfactory-positioning-page", type: "probe" } });
  await tick();
  assert.equal(checks, 1, "repeated probes share server validation");
  authorized = true;
  stored.accessToken = "current-account-token";
  storageChange({ accessToken: { newValue: stored.accessToken } }, "local");
  await tick();
  assert.equal(messages.at(-1).authorized, true);
  authorized = false;
  listeners.get("focus")();
  await tick();
  assert.equal(messages.at(-1).authorized, false, "focus rechecks expiry and account changes");
  listeners.get("message")({ source: window, data: { source: "contentfactory-positioning-page", type: "authorize", requestId: "rejected", token: "invalid-token", baseUrl: stored.baseUrl } });
  await tick();
  assert.equal(stored.accessToken, "current-account-token", "invalid token must not replace stored credentials");
  assert.equal(messages.at(-1).type, "authorization-complete");
  assert.equal(messages.at(-1).authorized, false);
});

test("capture rejection clears stale authorization but cannot erase a newer authorization", async () => {
  const popup = await readFile(path.join(repositoryRoot, "extensions/contentfactory-capture/popup.js"), "utf8");
  const callApi = popup.slice(popup.indexOf("async function callApi("), popup.indexOf("\nfunction renderCapture("));
  for (const renewed of [false, true]) {
    const stored = { baseUrl: "https://nrgc.xingren.me", accessToken: "old-token" };
    let removals = 0;
    const context = {
      DEFAULT_BASE_URL: stored.baseUrl,
      normalizeBaseUrl: (value) => new URL(value).origin,
      elements: { accessToken: { value: "old-token" } },
      chrome: { storage: { local: {
        async get(defaults) { return { ...defaults, ...stored }; },
        async remove(key) { removals++; delete stored[key]; },
      } } },
      fetch: async () => {
        if (renewed) stored.accessToken = "new-token";
        return { ok: false, status: 403, async json() { return { error: "Capture authorization is required" }; } };
      },
    };
    vm.runInNewContext(callApi, context);
    await assert.rejects(context.callApi("/api/capture/account", {}), /采集授权已失效/);
    assert.equal(removals, renewed ? 0 : 1);
    assert.equal(stored.accessToken, renewed ? "new-token" : undefined);
  }
});

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}
