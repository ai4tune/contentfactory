import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CREATE_FLOW_TEST_URL || "http://127.0.0.1:3012";

const source = { id: "demo-source", title: "演示企业资料", source: "upload", text: "我们只使用经过确认的企业事实。" };
const brief = {
  targetAudience: "企业负责人",
  contentGoal: "建立信任",
  coreMessage: "先验证一个真实场景",
  keyPoints: ["事实优先"],
  outline: ["问题", "案例", "建议"],
  callToAction: "欢迎讨论",
  citations: [{ sourceId: source.id, sourceTitle: source.title, sourceType: source.source, excerpt: source.text, purpose: "事实依据" }],
  openQuestions: [],
};

test("creation knowledge search recovers and project confirmation gives local feedback", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    let projectAttempts = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/materials", route => route.fulfill({ json: { materials: [source] } }));
    await page.route("**/api/knowledge-sources", route => route.fulfill({ json: { sources: [] } }));
    await page.route("**/api/inspirations", route => route.fulfill({ json: { inspirations: [] } }));
    await page.route("**/api/knowledge/search", route => route.fulfill({ json: { items: [] } }));
    await page.route("**/api/content/brief", route => route.fulfill({ json: { brief } }));
    await page.route("**/api/content/projects", route => {
      projectAttempts += 1;
      if (projectAttempts === 1) return route.fulfill({ status: 400, json: { error: "简报内容不完整" } });
      return route.fulfill({ status: 201, json: { project: { id: "demo-project", topic: "演示选题", accountSnapshot: null, styleSnapshot: null, selectedKnowledgeRefs: brief.citations, brief, channels: [], channelDrafts: [], status: "brief_confirmed", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() } } });
    });

    await page.goto(`${base}/create`, { waitUntil: "networkidle" });
    await page.getByText(source.title, { exact: true }).waitFor();
    await page.getByPlaceholder("搜索已连接知识和飞书").fill("不存在的内容");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByText("暂无资料。可先去知识库连接本地文件夹，或搜索飞书。").waitFor();
    await page.getByPlaceholder("搜索已连接知识和飞书").fill("");
    await page.getByText(source.title, { exact: true }).waitFor();

    await page.getByRole("button").filter({ hasText: source.title }).click();
    await page.getByLabel("这次想写什么").fill("演示选题");
    await page.getByRole("button", { name: "生成内容简报" }).click();
    await page.getByRole("button", { name: "确认简报并创建内容项目" }).click();
    await page.getByRole("alert").filter({ hasText: "创建失败：简报内容不完整" }).waitFor();
    await page.getByRole("button", { name: "确认简报并创建内容项目" }).click();
    await page.getByText("内容项目创建成功，请继续选择并生成渠道内容。").waitFor();
    assert.equal(projectAttempts, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
