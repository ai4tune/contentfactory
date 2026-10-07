// 本地隔离演示：不读取 .env，不连接生产，不使用客户数据。
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(tmpdir(), "brand-style-preview-"));
const date = "2026-10-01T00:00:00Z";
const source = { id: "demo:brand", title: "本地流程演示资料", sourceType: "upload" };
const context = { id: "current-account", status: "confirmed", source: "manual", accountName: "星河设计工作室（本地演示）", business: "提供品牌视觉设计服务", offer: "品牌视觉设计", conversionGoal: "让客户了解设计服务", platforms: ["朋友圈"], accountPosition: "为需要品牌设计的客户解释设计服务", targetAudience: ["需要品牌视觉设计的企业"], contentPillars: ["业务介绍"], brandVoice: ["自然"], preferredPhrases: ["先把问题说清楚"], bannedPhrases: ["保证效果"], contentDirections: [], recommendedTopics: [], analysisEvidence: ["演示业务资料"], informationGaps: ["价格和交付周期待补充"], answeredQuestions: [], updatedAt: date, confirmedAt: date };
const article = "本地流程演示：先把问题说清楚，再给出可执行的建议。资料没有说明的内容，先问清楚再写。";
const profile = { id: "current-style-profile", accountId: "current-account", status: "confirmed", version: 1, starterTemplate: { industry: "general", voice: "chat", version: 2 }, name: "星河工作室 · 原有口吻", persona: "从品牌介绍者的视角表达", readerRelationship: "向希望了解设计服务的人清楚说明", values: ["真实", "清楚"], tone: ["亲切、口语、简洁"], rules: [{ id: "starter-rule-0", category: "language", priority: "soft", instruction: "用日常短句介绍已知信息，少用术语，结尾自然邀请提问。", evidence: [{ sourceId: "starter:general:v2:chat", excerpt: "用日常短句介绍已知信息，少用术语，结尾自然邀请提问。" }] }, { id: "starter-rule-extra", category: "language", priority: "hard", instruction: "不要催促读者，不用感叹号", evidence: [{ sourceId: "starter:general:v2:chat", excerpt: "不要催促读者，不用感叹号" }] }], preferredPhrases: context.preferredPhrases, bannedPhrases: context.bannedPhrases, channelOverrides: { moments_post: ["不用感叹号"] }, examples: [{ id: "starter-example", sourceId: "starter:general:v2:chat", title: "旧模板例稿", excerpt: "先认识一下星河工作室，我们提供设计服务。", purpose: "只学习表达方式" }], sources: [{ id: "starter:general:v2:chat", title: "用户选择的初始配置 v2", sourceType: "manual", role: "style_guide" }], createdAt: date, updatedAt: date, confirmedAt: date };
await writeFile(path.join(directory, "contentfactory.local.json"), JSON.stringify({ accountContext: context, accountProfiles: [], accountCaptures: [{ accountName: "工作室旧账号", platform: "公众号", sourceUrl: "https://example.com/demo-account", bio: "旧账号介绍", capturedAt: date, pageType: "account", contents: [{ title: "本地流程演示的代表文章", description: article, url: "https://example.com/demo-article", metrics: {} }, { title: "只有标题的旧记录", metrics: {} }], accountMetrics: {}, operationalMetrics: {} }], materials: [], articles: [], inspirations: [], topicRadars: [] }));
await writeFile(path.join(directory, "style-profiles.local.json"), JSON.stringify({ confirmedProfile: profile, draftProfile: null }));
await writeFile(path.join(directory, "enterprise-knowledge-profiles.local.json"), JSON.stringify({ schemaVersion: 1, profiles: [{ id: "demo-knowledge", schemaVersion: 1, status: "confirmed", version: 1, createdAt: date, updatedAt: date, confirmedAt: date, name: context.accountName, businessSummary: context.business, targetCustomers: context.targetAudience, offers: [{ id: "demo-offer", name: context.offer, description: "品牌视觉设计服务", differentiators: [], sourceIds: [source.id] }], strengths: [], businessGoals: [context.conversionGoal], preferredTopics: [], forbiddenClaims: ["保证效果"], facts: [{ id: "demo-fact", category: "业务", statement: context.business, confidence: "confirmed", sourceIds: [source.id] }], gaps: context.informationGaps, sources: [source] }] }));
await cp(path.join(root, "public"), path.join(root, ".next/standalone/public"), { recursive: true });
await cp(path.join(root, ".next/static"), path.join(root, ".next/standalone/.next/static"), { recursive: true });
const children = [];
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|CONTENT_FACTORY|AI_|IMAGE_|FEISHU|WORKFLOW_/.test(key)));
for (const [script, env] of [
  ["src/tests/mock-ai-gateway.mjs", { MOCK_AI_PORT: "4481" }],
  [".next/standalone/server.js", { HOSTNAME: "127.0.0.1", PORT: "4482", CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_USER: "local-preview", CONTENT_FACTORY_ACCESS_CODE: "isolated-preview", AI_BASE_URL: "http://127.0.0.1:4481/v1", AI_API_KEY: "synthetic", AI_MODEL: "acceptance-mock", UPLOADS_ENABLED: "true", WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:4482" }],
]) {
  const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...environment, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stderr.on("data", (data) => process.stderr.write(data));
}
const authorization = `Basic ${Buffer.from("local-preview:isolated-preview").toString("base64")}`;
const proxy = createServer((req, res) => {
  const upstream = httpRequest({ hostname: "127.0.0.1", port: 4482, path: req.url, method: req.method, headers: { ...req.headers, host: "127.0.0.1:4482", authorization } }, (response) => {
    const headers = { ...response.headers };
    delete headers["www-authenticate"];
    if (headers.location) headers.location = headers.location.replace("http://127.0.0.1:4482", "http://127.0.0.1:4480");
    res.writeHead(response.statusCode, headers); response.pipe(res);
  });
  upstream.on("error", () => { res.writeHead(502); res.end("本地演示服务尚未准备好，请稍后刷新。"); });
  req.pipe(upstream);
});
await new Promise((resolve) => proxy.listen(4480, "127.0.0.1", resolve));
function stop() { proxy.closeAllConnections(); proxy.close(); children.forEach((child) => child.kill("SIGTERM")); }
process.once("SIGTERM", stop); process.once("SIGINT", stop);
for (let attempt = 0; attempt < 100; attempt++) {
  try { if ((await fetch("http://127.0.0.1:4482/api/health")).ok) {
    console.log("本地隔离演示：http://127.0.0.1:4480/brand");
    console.log("使用虚构资料与模拟模型，不连接生产。按 Ctrl+C 停止。演示资料目录：" + directory);
    break;
  } } catch {}
  if (attempt === 99) { stop(); throw new Error("本地演示启动超时，请检查端口 4480–4482。"); }
  await delay(100);
}
