import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const appPort = Number(process.env.ACCEPTANCE_APP_PORT || 4319);
const aiPort = Number(process.env.MOCK_AI_PORT || 4320);
const baseUrl = `http://127.0.0.1:${appPort}`;
const dataFiles = [
  "data/contentfactory.local.json",
  "data/content-projects.local.json",
  "data/knowledge-sources.local.json",
];
const backups = new Map();
const processes = [];
let serverOutput = "";

before(async () => {
  await backupDataFiles();
  const mock = spawn(process.execPath, [path.join(testDirectory, "mock-ai-gateway.mjs")], {
    cwd: repositoryRoot,
    env: { ...process.env, MOCK_AI_PORT: String(aiPort) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(mock);
  await waitForUrl(`http://127.0.0.1:${aiPort}/health`, 10_000);

  const nextBinary = process.env.NEXT_BIN || path.join(repositoryRoot, "node_modules/.bin/next");
  const app = spawn(nextBinary, ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      AI_BASE_URL: `http://127.0.0.1:${aiPort}/v1`,
      AI_API_KEY: "acceptance-test-key",
      AI_MODEL: "acceptance-mock",
      IMAGE_BASE_URL: `http://127.0.0.1:${aiPort}/v1`,
      IMAGE_API_KEY: "acceptance-image-key",
      IMAGE_MODEL: "gpt-image-2",
      IMAGE_SIZE: "1024x1536",
      FEISHU_APP_ID: "",
      FEISHU_APP_SECRET: "",
      UPLOADS_ENABLED: "true",
      CONTENT_FACTORY_CAPTURE_TOKEN: "acceptance-capture-token",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (chunk) => { serverOutput += chunk; });
  app.stderr.on("data", (chunk) => { serverOutput += chunk; });
  processes.push(app);
  await waitForUrl(`${baseUrl}/api/health`, 30_000);
});

after(async () => {
  for (const child of processes.reverse()) child.kill("SIGTERM");
  await Promise.all(processes.map(waitForExit));
  await restoreDataFiles();
});

test("P0 core API flow: account → knowledge → brief → four channels", async (context) => {
  const source = await loadAcceptanceSource();
  let draft;
  let brief;
  let project;

  await context.test("health and validation errors are explicit", async () => {
    const health = await requestJson("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.imageConfigured, true);

    const positioningError = await requestJson("/api/positioning/analyze", {
      method: "POST",
      body: {},
    });
    assert.equal(positioningError.response.status, 400);

    const knowledgeError = await requestJson("/api/knowledge/search", {
      method: "POST",
      body: { query: "" },
    });
    assert.equal(knowledgeError.response.status, 400);

    const briefError = await requestJson("/api/content/brief", {
      method: "POST",
      body: { topic: "", sources: [] },
    });
    assert.equal(briefError.response.status, 400);
  });

  await context.test("account positioning is analyzed, confirmed, and reused", async () => {
    const analyzed = await requestJson("/api/positioning/analyze", {
      method: "POST",
      body: {
        accountName: process.env.ACCEPTANCE_ACCOUNT_NAME || "杏仁内容工厂验收账号",
        business: "建材内容与企业 AI 服务",
        audience: "第一次装修的家庭与建材企业经营者",
        offer: "知识整理与四渠道内容交付",
        platforms: "公众号、小红书、朋友圈、短视频",
        goal: "建立信任并获得咨询",
      },
    });
    assert.equal(analyzed.response.status, 200);
    draft = analyzed.body.draft;
    assert.equal(draft.accountPosition, "面向装修家庭的建材决策顾问");

    const confirmed = await requestJson("/api/positioning/current", {
      method: "PATCH",
      body: { action: "confirm", draft },
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.context.status, "confirmed");

    const current = await requestJson("/api/positioning/current");
    assert.equal(current.body.context.accountPosition, draft.accountPosition);
  });

  await context.test("current positioning can be edited without losing AI evidence", async () => {
    const current = await requestJson("/api/positioning/current");
    const {
      id,
      status,
      confirmedAt,
      updatedAt,
      ...currentDraft
    } = current.body.context;
    void id;
    void status;
    void confirmedAt;
    void updatedAt;

    const updated = await requestJson("/api/positioning/current", {
      method: "PATCH",
      body: {
        action: "confirm",
        draft: {
          ...currentDraft,
          input: draft.input,
          brandVoice: ["专业", "真诚", "少说套话"],
        },
      },
    });
    assert.equal(updated.response.status, 200);
    assert.deepEqual(updated.body.context.brandVoice, ["专业", "真诚", "少说套话"]);
    assert.deepEqual(updated.body.context.analysisEvidence, current.body.context.analysisEvidence);
  });

  await context.test("knowledge source API responds without copying a local directory", async () => {
    const result = await requestJson("/api/knowledge-sources");
    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.body.sources));
    assert.equal(result.body.sources.some((item) => "text" in item), false);
  });

  await context.test("topic suggestions use the selected knowledge source", async () => {
    const result = await requestJson("/api/topics/suggest", {
      method: "POST",
      body: { sources: [source] },
    });
    assert.equal(result.response.status, 200);
    assert.ok(result.body.suggestions.length > 0);
    assert.deepEqual(result.body.suggestions[0].sourceIds, [source.id]);
  });

  await context.test("content brief preserves a traceable source excerpt", async () => {
    const result = await requestJson("/api/content/brief", {
      method: "POST",
      body: { topic: acceptanceTopic(), sources: [source] },
    });
    assert.equal(result.response.status, 200);
    brief = result.body.brief;
    assert.equal(brief.citations[0].sourceId, source.id);
    assert.ok(source.text.includes(brief.citations[0].excerpt));
    assert.equal(brief.outline.some((item) => item.includes("[object Object]")), false);
    assert.match(brief.outline[0], /价格误区/);
  });

  await context.test("viral rewriting can create a brief without treating the source as knowledge", async () => {
    const analyzed = await requestJson("/api/inspirations/analyze", {
      method: "POST",
      body: {
        platform: "小红书",
        sourceUrl: "https://www.xiaohongshu.com/explore/acceptance",
        title: "低价不等于省钱",
        metrics: "点赞 3200，收藏 980",
        content: "装修只比较单价容易踩坑，应该同时确认空间、基层、安装和售后。",
      },
    });
    assert.equal(analyzed.response.status, 200);

    const library = await requestJson("/api/inspirations");
    assert.equal(library.response.status, 200);
    assert.equal(library.body.inspirations[0].id, analyzed.body.record.id);
    assert.equal(library.body.inspirations[0].hook, "低价不等于省钱");

    const missing = await requestJson("/api/content/brief", {
      method: "POST",
      body: { topic: "测试爆款改写", sources: [], inspirationId: "missing" },
    });
    assert.equal(missing.response.status, 404);

    const viralBriefResult = await requestJson("/api/content/brief", {
      method: "POST",
      body: {
        topic: "企业做内容为什么不能只追求日更？",
        sources: [],
        inspirationId: analyzed.body.record.id,
      },
    });
    assert.equal(viralBriefResult.response.status, 200, serverOutput);
    assert.equal(viralBriefResult.body.brief.inspiration.id, analyzed.body.record.id);
    assert.equal(viralBriefResult.body.brief.citations.length, 0);

    const viralProjectResult = await requestJson("/api/content/projects", {
      method: "POST",
      body: {
        topic: "企业做内容为什么不能只追求日更？",
        brief: viralBriefResult.body.brief,
      },
    });
    assert.equal(viralProjectResult.response.status, 201);

    const generated = await requestJson("/api/content/generate", {
      method: "POST",
      body: {
        projectId: viralProjectResult.body.project.id,
        topic: viralProjectResult.body.project.topic,
        brief: viralBriefResult.body.brief,
        sources: [],
        channels: ["xiaohongshu_note"],
      },
    });
    assert.equal(generated.response.status, 200, serverOutput);
    assert.equal(generated.body.project.brief.inspiration.title, "低价不等于省钱");
    assert.equal(generated.body.project.channelDrafts[0].status, "generated");
  });

  await context.test("confirmed brief is saved as one atomic content project", async () => {
    const result = await requestJson("/api/content/projects", {
      method: "POST",
      body: { topic: acceptanceTopic(), brief },
    });
    assert.equal(result.response.status, 201);
    project = result.body.project;
    assert.equal(project.status, "brief_confirmed");
    assert.equal(project.accountSnapshot.status, "confirmed");
  });

  await context.test("one project generates four structurally distinct channel drafts", async () => {
    const channels = ["wechat_article", "xiaohongshu_note", "moments_post", "short_video_script"];
    const result = await requestJson("/api/content/generate", {
      method: "POST",
      body: { projectId: project.id, topic: acceptanceTopic(), brief, sources: [source], channels },
    });
    assert.equal(result.response.status, 200, serverOutput);
    project = result.body.project;
    assert.equal(project.channelDrafts.length, 4);
    assert.equal(project.channelDrafts.every((item) => item.status === "generated"), true);
    assert.equal(new Set(project.channelDrafts.map((item) => item.content)).size, 4);
    assert.match(project.channelDrafts.find((item) => item.channel === "wechat_article").content, /摘要|一、/);
    assert.match(project.channelDrafts.find((item) => item.channel === "xiaohongshu_note").content, /前三行|#/);
    assert.match(project.channelDrafts.find((item) => item.channel === "moments_post").content, /朋友|一起看/);
    assert.match(project.channelDrafts.find((item) => item.channel === "short_video_script").content, /前三秒|画面|口播/);
  });

  await context.test("a single channel can be retried without losing the project", async () => {
    const result = await requestJson("/api/content/generate/short_video_script", {
      method: "POST",
      body: { projectId: project.id, topic: acceptanceTopic(), brief, sources: [source], channels: ["short_video_script"] },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.project.id, project.id);
    assert.equal(result.body.draft.channel, "short_video_script");
  });

  await context.test("xiaohongshu storyboard uses one AI cover plus editable content cards", async () => {
    const beforeCount = await fetch(`http://127.0.0.1:${aiPort}/image-count`).then((response) => response.json());
    const generated = await requestJson(
      `/api/content/projects/${project.id}/channels/xiaohongshu_note/images`,
      { method: "POST", body: {} },
    );
    assert.equal(generated.response.status, 200, serverOutput);
    assert.equal(generated.body.assets.length, 5);
    assert.equal(generated.body.assets[0].kind, "cover");
    assert.equal(generated.body.assets.every((item) => item.status === "generated"), true);
    assert.equal(generated.body.assets.slice(1).every((item) => item.kind === "card"), true);
    assert.equal(generated.body.assets.slice(1).every((item) => !item.imageUrl), true);
    assert.equal(generated.body.assets.slice(1).every((item) => item.body), true);
    const afterCount = await fetch(`http://127.0.0.1:${aiPort}/image-count`).then((response) => response.json());
    assert.equal(afterCount.count - beforeCount.count, 1);
    project = generated.body.project;

    const firstAsset = generated.body.assets[0];
    const firstCard = generated.body.assets[1];
    const editedCard = await requestJson(
      `/api/content/projects/${project.id}/channels/xiaohongshu_note/images`,
      {
        method: "PATCH",
        body: {
          assetId: firstCard.id,
          title: "人工确认后的问题页",
          body: "内页文字可以继续编辑，不需要重新调用生图服务。",
          points: ["保留正文事实", "调整阅读顺序"],
        },
      },
    );
    assert.equal(editedCard.response.status, 200);
    assert.equal(editedCard.body.asset.title, "人工确认后的问题页");
    assert.deepEqual(editedCard.body.asset.points, ["保留正文事实", "调整阅读顺序"]);
    project = editedCard.body.project;

    const rejectedCardRetry = await requestJson(
      `/api/content/projects/${project.id}/channels/xiaohongshu_note/images`,
      { method: "POST", body: { assetId: firstCard.id } },
    );
    assert.equal(rejectedCardRetry.response.status, 400);

    const retried = await requestJson(
      `/api/content/projects/${project.id}/channels/xiaohongshu_note/images`,
      { method: "POST", body: { assetId: firstAsset.id } },
    );
    assert.equal(retried.response.status, 200, serverOutput);
    assert.equal(retried.body.assets.length, 5);
    assert.equal(retried.body.assets[0].id, firstAsset.id);
    assert.notEqual(retried.body.assets[0].imageUrl, firstAsset.imageUrl);
    project = retried.body.project;

    const download = await fetch(
      `${baseUrl}/api/content/projects/${project.id}/channels/xiaohongshu_note/images/${firstAsset.id}`,
    );
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") ?? "", /image\/png/);
    assert.ok((await download.arrayBuffer()).byteLength > 0);

    const detail = await requestJson(`/api/content-drafts/${project.id}`);
    const xiaohongshu = detail.body.draft.channelDrafts.find(
      (item) => item.channel === "xiaohongshu_note",
    );
    assert.equal(xiaohongshu.visualAssets.length, 5);
    assert.equal(xiaohongshu.visualAssets[1].title, "人工确认后的问题页");
  });

  await context.test("AI review separates fact, style, and platform issues", async () => {
    const result = await requestJson(`/api/content/projects/${project.id}/channels/wechat_article/review`, {
      method: "POST",
      body: {},
    });
    assert.equal(result.response.status, 200);
    project = result.body.project;
    assert.deepEqual(
      new Set(result.body.review.issues.map((issue) => issue.category)),
      new Set(["fact", "style", "platform"]),
    );
    assert.equal(result.body.review.issues.some((issue) => issue.autoFixable), true);
  });

  await context.test("one safe review suggestion can be applied and the draft can be edited", async () => {
    const reviewedDraft = project.channelDrafts.find((item) => item.channel === "wechat_article");
    const issue = reviewedDraft.review.issues.find((item) => item.autoFixable);
    const applied = await requestJson(
      `/api/content/projects/${project.id}/channels/wechat_article/review/issues/${issue.id}/apply`,
      { method: "POST", body: {} },
    );
    assert.equal(applied.response.status, 200);
    assert.match(
      applied.body.project.channelDrafts.find((item) => item.channel === "wechat_article").content,
      /单价比较误区/,
    );

    const editedContent = "公众号人工编辑终稿\n\n保留可追溯事实，并补充人工确认后的表达。";
    const edited = await requestJson(`/api/content/projects/${project.id}/channels/wechat_article`, {
      method: "PATCH",
      body: { content: editedContent },
    });
    assert.equal(edited.response.status, 200);
    assert.equal(
      edited.body.project.channelDrafts.find((item) => item.channel === "wechat_article").content,
      editedContent,
    );
    project = edited.body.project;
  });

  await context.test("draft history survives reload, versions edits, and exports Markdown", async () => {
    const list = await requestJson(`/api/content-drafts?query=${encodeURIComponent(acceptanceTopic())}`);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.drafts.some((item) => item.id === project.id), true);

    const detail = await requestJson(`/api/content-drafts/${project.id}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.draft.channelDrafts.length, 4);

    const editedContent = "朋友圈人工修改版本：先核对空间、基层、安装与售后。";
    const edited = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: { channel: "moments_post", content: editedContent },
    });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.body.draft.reviewStatus, "editing");
    assert.ok(edited.body.draft.versions.length > 0);

    const exportResponse = await fetch(`${baseUrl}/api/content-drafts/${project.id}/export?channel=moments_post`);
    const markdown = await exportResponse.text();
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(markdown, /朋友圈文案/);
    assert.match(markdown, /朋友圈人工修改版本/);
  });

  await context.test("human approval is explicit and later changes require reapproval", async () => {
    const invalid = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: { reviewStatus: "draft" },
    });
    assert.equal(invalid.response.status, 400);

    const approved = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: { reviewStatus: "approved" },
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.draft.reviewStatus, "approved");

    const approvedList = await requestJson("/api/content-drafts?reviewStatus=approved");
    assert.equal(approvedList.body.drafts.some((item) => item.id === project.id), true);

    const regenerated = await requestJson("/api/content/generate/short_video_script", {
      method: "POST",
      body: {
        projectId: project.id,
        topic: acceptanceTopic(),
        brief,
        sources: [source],
        channels: ["short_video_script"],
      },
    });
    assert.equal(regenerated.response.status, 200);
    assert.equal(regenerated.body.project.reviewStatus, "editing");

    const reapproved = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: { reviewStatus: "approved" },
    });
    assert.equal(reapproved.response.status, 200);
    assert.equal(reapproved.body.draft.reviewStatus, "approved");

    const changedAgain = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: {
        channel: "moments_post",
        content: "朋友圈再次人工修改：发布前重新核对事实和表达。",
      },
    });
    assert.equal(changedAgain.response.status, 200);
    assert.equal(changedAgain.body.draft.reviewStatus, "editing");

    const finalApproval = await requestJson(`/api/content-drafts/${project.id}`, {
      method: "PATCH",
      body: { reviewStatus: "approved" },
    });
    assert.equal(finalApproval.response.status, 200);
    assert.equal(finalApproval.body.draft.reviewStatus, "approved");
  });

  await context.test("a generated channel can be recorded as published with real metrics", async () => {
    const invalid = await requestJson(`/api/content-drafts/${project.id}/publication`, {
      method: "POST",
      body: { channel: "unknown", publishedAt: new Date().toISOString() },
    });
    assert.equal(invalid.response.status, 400);

    const publishedAt = "2026-07-23T02:00:00.000Z";
    const result = await requestJson(`/api/content-drafts/${project.id}/publication`, {
      method: "POST",
      body: {
        channel: "wechat_article",
        url: "https://example.com/published-content",
        publishedAt,
        metrics: { views: 1250, likes: 88, saves: 42, comments: 16, replies: 5 },
      },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.publication.channel, "wechat_article");
    assert.equal(result.body.publication.metrics.views, 1250);

    const detail = await requestJson(`/api/content-drafts/${project.id}`);
    assert.equal(detail.body.draft.publications.length, 1);
    assert.equal(detail.body.draft.publications[0].publishedAt, publishedAt);

    const libraryResponse = await fetch(`${baseUrl}/articles`);
    const libraryHtml = await libraryResponse.text();
    assert.equal(libraryResponse.status, 200);
    assert.match(libraryHtml, /内容库/);
    assert.match(libraryHtml, /1250/);
  });

  await context.test("legacy object placeholders are removed when a saved draft is read", async () => {
    const projectStorePath = path.join(repositoryRoot, "data/content-projects.local.json");
    const store = JSON.parse(await readFile(projectStorePath, "utf8"));
    store.projects = store.projects.map((item) => item.id === project.id
      ? { ...item, brief: { ...item.brief, outline: ["[object Object]", "[object Object]"] } }
      : item);
    await writeFile(projectStorePath, JSON.stringify(store, null, 2));

    const result = await requestJson(`/api/content-drafts/${project.id}`);
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.draft.brief.outline, []);
  });

  await context.test("account capture rejects unknown callers, then supports preview and confirm", async () => {
    const rejected = await requestJson("/api/capture/account", {
      method: "POST",
      body: { action: "analyze" },
    });
    assert.equal(rejected.response.status, 403);

    const captured = await requestJson("/api/capture/account", {
      method: "POST",
      headers: { Authorization: "Bearer acceptance-capture-token", Origin: baseUrl },
      body: {
        action: "analyze",
        capture: {
          platform: "小红书",
          pageType: "account",
          sourceUrl: "https://www.xiaohongshu.com/user/profile/acceptance",
          accountName: "崔总建材账号",
          bio: "分享 SPC 地板、安装和装修选购知识",
          followerCount: "1200",
          accountMetrics: {
            following: { raw: "20", value: 20, visibility: "public" },
            followers: { raw: "1200", value: 1200, visibility: "public" },
            likesAndCollects: { raw: "332", value: 332, visibility: "public" },
          },
          contents: [{
            title: "装修选地板的三个误区",
            url: "https://www.xiaohongshu.com/explore/acceptance-note",
            metrics: {
              likes: { raw: "88", value: 88, visibility: "public" },
            },
            metricSummary: "点赞 88",
          }],
          interactionSummary: "选购避坑内容互动较高",
          capturedAt: "2026-07-21T00:00:00.000Z",
        },
      },
    });
    assert.equal(captured.response.status, 200);
    assert.equal(captured.body.capture.accountName, "崔总建材账号");
    assert.equal(captured.body.capture.accountMetrics.followers.value, 1200);
    assert.equal(captured.body.capture.contents[0].metrics.likes.value, 88);
    assert.equal(captured.body.draft.source, "capture");

    const refreshed = await requestJson("/api/positioning/refresh-capture", {
      method: "POST",
      body: {},
    });
    assert.equal(refreshed.response.status, 200);
    assert.equal(refreshed.body.capture.contents[0].title, "装修选地板的三个误区");
    assert.equal(refreshed.body.draft.source, "capture");

    const confirmed = await requestJson("/api/capture/account", {
      method: "POST",
      headers: { Authorization: "Bearer acceptance-capture-token", Origin: baseUrl },
      body: { action: "confirm", draft: refreshed.body.draft },
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.context.source, "capture");
    assert.equal(confirmed.body.context.status, "confirmed");
  });
});

async function loadAcceptanceSource() {
  const configuredPath = process.env.ACCEPTANCE_KNOWLEDGE_FILE;
  const sourcePath = configuredPath
    ? path.resolve(configuredPath)
    : path.join(testDirectory, "fixtures/local-knowledge.md");
  const text = await readFile(sourcePath, "utf8");
  const scenario = configuredPath ? "customer" : "local-fixture";
  return {
    id: `local:acceptance/${scenario}/${path.basename(sourcePath)}`,
    title: path.basename(sourcePath, path.extname(sourcePath)),
    source: "local",
    path: sourcePath,
    text,
  };
}

function acceptanceTopic() {
  return process.env.ACCEPTANCE_TOPIC || "SPC 地板选购为什么不能只看价格？";
}

async function requestJson(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || "GET",
    headers: options.body === undefined
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  return { response, body };
}

async function waitForUrl(url, timeout) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput}`);
}

async function backupDataFiles() {
  for (const relativePath of dataFiles) {
    const filePath = path.join(repositoryRoot, relativePath);
    try {
      await access(filePath);
      backups.set(relativePath, await readFile(filePath));
    } catch {
      backups.set(relativePath, null);
    }
  }
}

async function restoreDataFiles() {
  for (const [relativePath, content] of backups) {
    const filePath = path.join(repositoryRoot, relativePath);
    if (content === null) {
      await rm(filePath, { force: true });
    } else {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }
  }
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolve();
    }, 5_000).unref();
  });
}
