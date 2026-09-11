import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

// Run against an isolated server, with a locally available Playwright installation.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.RADAR_TEST_URL || "http://127.0.0.1:3011";

test("radar tabs respond without waiting for route or history requests", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    let routeRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/market/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({ json: { records: [], accounts: [] } });
    });
    await page.route("**/*", async route => {
      if (new URL(route.request().url()).searchParams.has("_rsc")) {
        routeRequests += 1;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await route.fallback();
    });
    await page.goto(`${base}/radar`, { waitUntil: "networkidle" });
    const before = routeRequests;
    await page.getByRole("button", { name: "趋势", exact: true }).or(page.getByRole("link", { name: "趋势", exact: true })).click();
    await page.getByRole("heading", { name: "热搜趋势对比" }).waitFor({ timeout: 800 });
    assert.equal(routeRequests, before, "tab navigation must not request a server route");
    await page.getByRole("button", { name: "主题搜索", exact: true }).or(page.getByRole("link", { name: "主题搜索", exact: true })).click();
    await page.getByRole("heading", { name: "主题搜索", exact: true }).waitFor({ timeout: 800 });
    await page.getByRole("button", { name: "对标账号", exact: true }).or(page.getByRole("link", { name: "对标账号", exact: true })).click();
    assert.match(page.url(), /tab=accounts/);
    await page.goBack();
    await page.getByRole("heading", { name: "主题搜索", exact: true }).waitFor({ timeout: 800 });
    await page.reload();
    await page.getByRole("heading", { name: "主题搜索", exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
