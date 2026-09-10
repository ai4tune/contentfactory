import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, symlink, cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = { id: "own-proof", title: "企业资料", source: "local", text: "企业事实标记：我们只提供已验证的服务。" };

test("V2 search → idea → brief → project uses isolated data and mock providers", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "contentfactory-v2-"));
  let app;
  const calls = [];
  const prompts = [];
  let failAccountWorks = false;
  const mock = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/chat/completions") {
      prompts.push(body.messages);
      const system = body.messages[0].content;
      const content = system.includes("爆款拆解助手") ? {
        summary: "可复用分析", hook: "问题开头", structure: ["提出问题", "分析原因", "行动建议"],
        targetAudience: "企业", painPoint: "表达", pacing: "先问题后建议", evidence: [], callToAction: "讨论",
        reusablePatterns: ["解释原因"], keywords: ["AI"], adaptationIdeas: ["换企业案例"], topicCandidates: ["实践"], riskNotes: [],
      } : system.includes("内容策略编辑") ? {
        targetAudience: "企业", contentGoal: "建立信任", coreMessage: "用自己的事实表达",
        keyPoints: ["事实优先"], outline: ["问题", "证据", "建议"], callToAction: "讨论", openQuestions: [],
        citations: [{ sourceId: source.id, excerpt: source.text, purpose: "事实证据" }],
      } : { content: "测试渠道稿件：只使用企业知识中的已验证事实。" };
      return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    }
    calls.push({ url: req.url, method: req.method, headers: req.headers, body });
    const url = new URL(req.url, "http://mock");
    const ok = (data) => res.end(JSON.stringify({ code: 2000, data }));
    if (url.pathname === "/story/api/hotKeyword/list") {
      assert.match(body.startDate, / 00:00:00$/);
      return ok([{ keyword: "AI企业落地", hotSpotList: [{ title: "AI案例", platName: "抖音", url: "https://www.douyin.com/hot/1" }] }]);
    }
    if (url.pathname === "/story/api/cozeSkill/getXhsCozeSkillDataOne") {
      assert.equal(req.method, "GET"); assert.ok(url.searchParams.get("rankDate"));
      if (url.searchParams.get("category") === "坏格式") return ok({ surprise: true });
      return ok([{ title: "小红书榜单", photoJumpUrl: "https://www.xiaohongshu.com/explore/hot-1", userName: "榜单作者", fans: "2w+", anaAdd: { useLikeCount: "35w+", collectedCount: "0", useCommentCount: "12" } }]);
    }
    if (url.pathname === "/story/api/dy/search/likesRank") return ok([{ workId: "dy-hot", title: "抖音热榜", workUrl: "https://www.douyin.com/video/dy-hot", likeCount: 0 }]);
    if (url.pathname === "/story/api/gzh/search/hotArticle") return ok({ articles: [{ id: "wx-hot", title: "公众号热榜", url: "https://mp.weixin.qq.com/s/wx-hot", clicksCount: 5001, commentsCount: 0 }] });
    if (url.pathname === "/story/api/hotSpot/getListByPlatformWithKeyword") {
      if (body.keywords.includes("无样本")) return ok({ dyList: [] });
      if (body.keywords.includes("失败测试")) return res.end(JSON.stringify({ code: 3201, msg: "积分不足" }));
      return ok({ dyList: [{ title: "AI热搜", url: "https://www.douyin.com/hot/1", index: 1, hotCount: "2万", gmtCreate: body.startDate + " 12:00:00" }], wbList: [] });
    }
    if (url.pathname === "/story/api/xhsUser/queryAccountDetail") { assert.ok(body.accountId); return ok({ userId: "xhs-user-1", accountId: body.accountId, accountName: "测试小红书", accountFans: 0, accountTotalWorks: 2 }); }
    if (url.pathname === "/story/api/dyData/queryUser") { assert.ok(body.accountId); return ok({ uid: "dy-user-1", nickname: "测试抖音", followerCount: 0, awemeCount: 3 }); }
    if (url.pathname === "/story/api/gzhData/queryUser") { assert.ok(body.account); return ok({ account: body.account, accountName: "测试公众号" }); }
    if (url.pathname === "/story/api/xhsUser/queryWorkList") {
      assert.ok(body.redId); assert.equal(body.offset, 0);
      if (failAccountWorks) return res.end(JSON.stringify({ code: 3201, msg: "积分不足" }));
      return ok({ list: [{ workId: "xhs-list-1", workTitle: "近期笔记", workLikedCount: 12, workCollectedCount: 0, workUrl: "https://www.xiaohongshu.com/explore/xhs-list-1" }] });
    }
    if (url.pathname === "/story/api/dyData/queryWorkList") { assert.ok(body.accountId); return ok({ list: [{ workId: "dy-list-1", title: "近期视频", likeCount: 0 }] }); }
    if (url.pathname === "/story/api/gzhData/queryWorkList") { assert.ok(body.account); return ok({ list: [] }); }
    if (url.pathname === "/story/api/sphAllData/searchWork") { assert.equal(body.size, 20); return ok({ list: [{ videoId: "sph-1", description: "视频号AI案例", nickname: "视频号作者", favCount: 0, likeCount: 5, forwardCount: 3, videoUrl: "https://findermp.video.qq.com/video/1" }] }); }
    if (body.keyword === "余额测试") return res.end(JSON.stringify({ code: 3201, msg: "积分不足" }));
    if (req.url === "/story/api/xhs/ability/searchWork") {
      return res.end(JSON.stringify({ workList: [{ noteId: "note-1", noteTitle: "效率提升100%", noteType: "normal", noteUrl: "https://www.xiaohongshu.com/explore/note-1?token=a%25", authorName: "作者", authorUid: "author-1", thumbCount: 10, favoriteCount: 0, replyCount: 2, forwardCount: 1, releaseTime: "2026-09-08 10:00:00" }] }));
    }
    if (["/story/api/dyData/searchArticle", "/story/api/gzhData/searchArticle"].includes(url.pathname)) return ok({ list: [{ workId: "work-1", workUuid: "uuid-1", title: "企业AI获客", workType: "视频", workUrl: "https://www.douyin.com/video/work-1", author: "公众号作者", accountName: "作者", followerCount: 100, content: "市场摘录标记：这是外部经验，不是企业事实。", likeCount: 80, collectCount: 0, commentCount: 3, shareCount: 1, publishTime: "2026-09-08 10:00:00" }] });
    res.statusCode = 404; res.end(JSON.stringify({ error: "Unexpected endpoint" }));
  });
  const mockPort = await listen(mock);
  const portProbe = createServer();
  const port = await listen(portProbe);
  await new Promise((resolve) => portProbe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  async function request(url, body) {
    const response = await fetch(base + url, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  async function start() {
    app = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: directory,
      env: { ...process.env, AI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, AI_API_KEY: "mock", AI_MODEL: "mock", REDFOX_API_KEY: "mock-redfox", REDFOX_BASE_URL: `http://127.0.0.1:${mockPort}`, FEISHU_APP_ID: "", FEISHU_APP_SECRET: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.resume(); app.stderr.resume();
    for (let i = 0; i < 100; i++) {
      if (app.exitCode !== null) throw new Error("Test app failed to start");
      try { if ((await fetch(base + "/api/health")).ok) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Test app timeout");
  }
  async function stop() { if (app && app.exitCode === null) { const exited = once(app, "exit"); app.kill("SIGTERM"); await exited; } }
  try {
    await symlink(path.join(root, ".next"), path.join(directory, ".next"));
    await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
    await cp(path.join(root, "package.json"), path.join(directory, "package.json"));
    await mkdir(path.join(directory, "data"));
    // Old schema and abandoned creating state must remain usable after migration.
    const old = new Database(path.join(directory, "data/contentfactory.db"));
    old.exec("CREATE TABLE ideas (id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT, source_url TEXT, platform TEXT, market_item_id TEXT, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO ideas (id,title,status) VALUES ('legacy','旧选题','creating')");
    old.close();
    await start();
    let market, idea, brief, project;
    await t.test("percent titles render and abandoned ideas stay in the pool", async () => {
      assert.equal((await fetch(base + "/create?title=" + encodeURIComponent("效率提升100%"))).status, 200);
      assert.equal((await request("/api/ideas?status=pool")).body.data[0].id, "legacy");
    });
    await t.test("official search contracts preserve ids, URLs and zero metrics; cache avoids duplicate calls", async () => {
      for (const platform of ["xiaohongshu", "douyin", "wechat"]) {
        const input = { platform, keyword: "企业AI", page: 1, pageSize: 20 };
        const first = await request("/api/market/search", input);
        assert.equal(first.status, 200, JSON.stringify(first.body));
        const item = first.body.data.items[0];
        assert.equal(item.metrics.collects, 0);
        assert.ok(item.sourceUrl);
        const second = await request("/api/market/search", input);
        assert.equal(second.body.data.items[0].id, item.id);
        if (platform === "douyin") market = item;
      }
      assert.equal(calls.length, 3);
      assert.ok(calls.every((call) => call.headers.redfox_api_key === "mock-redfox" && !call.headers.authorization));
      assert.equal(calls[0].body.sort, "综合");
      assert.equal(calls[1].body.offset, 0);
      assert.equal(calls[2].body.sortType, "_0");
      const denied = await request("/api/market/search", { platform: "douyin", keyword: "余额测试" });
      assert.equal(denied.status, 500);
      assert.match(denied.body.message, /3201/);
    });
    await t.test("opening an idea is non-destructive and loads server-side source context", async () => {
      idea = (await request("/api/ideas", { title: "效率提升100%", summary: market.summary, sourceUrl: market.sourceUrl, marketItemId: market.id })).body.data;
      const opened = await request(`/api/ideas/${idea.id}/create-project`, {});
      assert.equal(opened.status, 200);
      const page = await fetch(base + opened.body.data.createUrl);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /效率提升100%/);
      assert.ok((await request("/api/ideas?status=pool")).body.data.some((item) => item.id === idea.id));
      assert.equal((await request("/api/ideas?status=used")).body.data.length, 0);
    });
    await t.test("market reference reaches the model and saved project, separate from knowledge citations", async () => {
      const response = await request("/api/content/brief", { topic: "企业AI", ideaId: idea.id, sources: [source] });
      assert.equal(response.status, 200);
      brief = response.body.brief;
      assert.equal(brief.ideaContext.marketItemId, market.id);
      assert.match(brief.ideaContext.excerpt, /市场摘录标记/);
      assert.match(JSON.stringify(prompts.at(-1)), /市场摘录标记/);
      assert.equal(brief.citations[0].sourceId, source.id);
      const invalid = await request("/api/content/projects", { topic: "企业AI", ideaId: idea.id, brief: {} });
      assert.equal(invalid.status, 400);
      assert.ok((await request("/api/ideas?status=pool")).body.data.some((item) => item.id === idea.id));
      const saved = await request("/api/content/projects", { topic: "企业AI", ideaId: idea.id, brief });
      assert.equal(saved.status, 201, JSON.stringify(saved.body));
      project = saved.body.project;
      assert.equal(project.sourceIdeaId, idea.id);
      assert.equal(project.brief.ideaContext.sourceUrl, market.sourceUrl);
      assert.ok(!(await request("/api/ideas?status=pool")).body.data.some((item) => item.id === idea.id));
      assert.deepEqual((await request("/api/ideas?status=used")).body.data[0].contentProjectIds, [project.id]);
      const channels = ["wechat_article", "xiaohongshu_note", "moments_post", "short_video_script"];
      const generated = await request("/api/content/generate", { projectId: project.id, channels, sources: [source] });
      assert.equal(generated.status, 200);
      assert.equal(generated.body.project.channelDrafts.filter((draft) => draft.status === "generated").length, 4);
      assert.ok(prompts.slice(-4).every((messages) => JSON.stringify(messages).includes("市场摘录标记")));
    });
    await t.test("inspiration identity persists and repeated market capture preserves its body", async () => {
      const analyzed = await request("/api/inspirations/analyze", { platform: "douyin", title: market.title, sourceUrl: market.sourceUrl, content: "已经整理的原始正文，不应该被空数据覆盖。" });
      assert.equal(analyzed.status, 200);
      const id = analyzed.body.record.id;
      const created = await request(`/api/inspirations/${id}/create-idea`, {});
      assert.equal(created.status, 200);
      const page = await fetch(base + `/create?ideaId=${created.body.data.id}`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /可复用分析/);
      const db = new Database(path.join(directory, "data/contentfactory.db"));
      db.prepare("UPDATE market_items SET body = NULL WHERE id = ?").run(market.id);
      db.close();
      const captured = await request(`/api/market/items/${market.id}/save-to-inspiration`, {});
      assert.equal(captured.status, 200);
      assert.match(captured.body.data.record.content.body, /已经整理/);
      assert.equal(captured.body.data.record.analysis.hook, "问题开头");
    });
    await t.test("hot lists use the correct method, persist and preserve approximate and zero metrics", async () => {
      const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      for (const platform of ["xiaohongshu", "douyin", "wechat"]) {
        const first = await request("/api/market/hot", { platform, date });
        assert.equal(first.status, 200, JSON.stringify(first.body));
        assert.equal(first.body.items.length, 1);
        const item = first.body.items[0];
        if (platform === "xiaohongshu") { assert.equal(item.metrics.likes, 350000); assert.equal(item.metrics.collects, 0); }
        if (platform === "douyin") assert.equal(item.metrics.likes, 0);
        if (platform === "wechat") assert.equal(item.metrics.views, 5001);
        const count = calls.length;
        const db = new Database(path.join(directory, "data/contentfactory.db"));
        db.prepare("UPDATE market_items SET body = '已补充的榜单正文' WHERE id = ?").run(item.id); db.close();
        const second = await request("/api/market/hot", { platform, date });
        assert.equal(second.body.items[0].id, item.id); assert.equal(calls.length, count);
        const saved = await request(`/api/market/items/${item.id}/save-to-inspiration`, {});
        assert.equal(saved.status, 200);
        assert.equal(saved.body.data.record.source.captureMethod, "api");
        assert.equal(saved.body.data.record.content.body, "已补充的榜单正文");
        if (platform === "douyin") assert.equal(saved.body.data.record.metrics.likes.value, 0);
      }
      const beforeInvalid = calls.length;
      for (const platform of ["xiaohongshu", "douyin"]) {
        assert.equal((await request("/api/market/hot", { platform, date, category: "咖啡店" })).status, 400);
      }
      assert.equal(calls.length, beforeInvalid, "invalid categories must not call a paid provider");
      assert.equal((await request("/api/market/hot", { platform: "xiaohongshu", date, category: "美味佳肴" })).status, 200);
      assert.equal((await request("/api/market/hot", { platform: "douyin", date, category: "美食" })).status, 200);
      assert.equal((await request("/api/market/hot", { platform: "wechat", date, category: "咖啡店" })).status, 200);
      assert.equal((await request("/api/market/search", { platform: "xiaohongshu", keyword: "咖啡店" })).status, 200);
      const dyAll = calls.find(call => call.url.includes("likesRank"));
      assert.equal(Object.hasOwn(dyAll.body, "type"), false, "all categories omit the optional Douyin type");
      assert.equal((await request("/api/market/hot", { platform: "channels", date })).status, 400);
      assert.equal((await request("/api/market/hot", { platform: "douyin", date: "2026-02-31" })).status, 400);
    });
    await t.test("channels search preserves video identity and missing views", async () => {
      const result = await request("/api/market/search", { platform: "channels", keyword: "AI" });
      assert.equal(result.status, 200);
      const item = result.body.data.items[0];
      assert.equal(item.id, "channels_sph-1"); assert.equal(item.title, "视频号AI案例");
      assert.equal(item.metrics.collects, 0); assert.equal(item.metrics.views, null); assert.equal(item.contentType, "video");
    });
    await t.test("hotspots and trends compare explicit adjacent windows without fabricating empty baselines", async () => {
      const result = await request("/api/market/trends", { platform: "douyin", keyword: "AI", days: 7 });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.currentAverage, 20000); assert.equal(result.body.growth, 0);
      const requests = calls.filter(call => call.url.includes("hotSpot"));
      assert.equal(requests.length, 2); assert.deepEqual(requests[0].body.platforms, [2]);
      assert.equal(Date.parse(result.body.windows.end) - Date.parse(result.body.windows.middle), 7 * 86400000);
      const empty = await request("/api/market/trends", { platform: "douyin", keyword: "无样本", days: 3 });
      assert.equal(empty.status, 200); assert.equal(empty.body.growth, null);
      assert.equal((await request("/api/market/trends", { platform: "douyin", keyword: "失败测试", days: 3 })).status, 502);
      assert.equal((await request("/api/market/trends", { platform: "xiaohongshu", keyword: "AI", days: 7 })).status, 400);
      assert.equal((await request("/api/market/trends", { platform: "douyin", keyword: "AI", days: 30 })).status, 400);
      const today = new Date().toISOString().slice(0, 10), tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const hot = await request("/api/market/hotspots", { platform: "douyin", startDate: today, endDate: tomorrow });
      assert.equal(hot.status, 200); assert.equal(hot.body.items[0].heatLabel, "2万");
      const keywords = await request("/api/market/hot-keywords", { date: today });
      assert.equal(keywords.status, 200); assert.equal(keywords.body.items[0].keyword, "AI企业落地");
      assert.equal(keywords.body.items[0].sources[0].platform, "抖音");
    });
    await t.test("tracked accounts persist and failed refresh cannot overwrite the saved bundle", async () => {
      for (const platform of ["xiaohongshu", "douyin", "wechat"]) {
        const result = await request("/api/market/accounts", { platform, accountId: "user1" });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.account.followers, platform === "wechat" ? null : 0);
      }
      const before = (await request("/api/market/accounts")).body.accounts;
      assert.equal(before.length, 3);
      const xhs = before.find(item => item.account.platform === "xiaohongshu");
      assert.equal(xhs.items[0].metrics.likes, 12);
      const db = new Database(path.join(directory, "data/contentfactory.db"));
      db.prepare("DELETE FROM provider_cache WHERE endpoint = 'xhsUser/queryWorkList'").run(); db.close();
      failAccountWorks = true;
      assert.equal((await request(`/api/market/accounts/${xhs.account.id}`, {})).status, 502);
      assert.deepEqual((await request("/api/market/accounts")).body.accounts, before);
      failAccountWorks = false;
      assert.equal((await request(`/api/market/accounts/${xhs.account.id}`, {})).status, 200);
      await stop(); await start();
      assert.equal((await request("/api/market/accounts")).body.accounts.length, 3);
      assert.equal((await fetch(base + `/api/market/accounts/${xhs.account.id}`, { method: "DELETE" })).status, 200);
      assert.equal((await request("/api/market/accounts")).body.accounts.length, 2);
    });
    await t.test("used projects and pool survive app restart", async () => {
      await stop(); await start();
      assert.deepEqual((await request("/api/ideas?status=used")).body.data[0].contentProjectIds, [project.id]);
      assert.ok((await request("/api/ideas?status=pool")).body.data.some((item) => item.id === "legacy"));
    });
    if (process.env.V2_BROWSER_VERIFY === "1") {
      console.log(`Browser verification sandbox: ${base}/radar (mock providers, temporary data)`);
      await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
    }
  } finally {
    await stop();
    await new Promise((resolve) => mock.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}
