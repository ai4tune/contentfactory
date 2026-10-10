import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const cache = new Map();
async function moduleUrl(file) {
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(await readFile(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...code.matchAll(/from "([^"]+)"/g)]) {
    const ref = match[1];
    const target = ref.startsWith("@/") ? path.join(root, "src", ref.slice(2)) : path.resolve(path.dirname(file), ref);
    code = code.replace(`from "${ref}"`, `from "${await moduleUrl(target + ".ts")}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  cache.set(file, url); return url;
}
const calendar = await import(await moduleUrl(path.join(root, "src/modules/plans/calendar.ts")));
const tasks = await import(await moduleUrl(path.join(root, "src/modules/dashboard/task.ts")));
const parser = await import(await moduleUrl(path.join(root, "src/modules/plans/request.ts")));
const account = { conversionGoal: "介绍服务", targetAudience: ["有需求的顾客"], platforms: ["公众号"] };
const plan = { id: "p", status: "confirmed", periodStart: "2026-10-26", periodEnd: "2026-11-24", pillars: [{ id: "pillar" }], items: [] };
const item = (id, date, extra = {}) => ({ id, title: id, week: 1, scheduledDate: date, priority: 1, rationale: "按真实资料写", status: "pending", ...extra });
const draft = (extra = {}) => ({ id: "d", topic: "已有内容", channels: ["wechat_article"], generatedChannels: ["wechat_article"], failedChannels: [], reviewStatus: "draft", projectStatus: "generated", publications: [], ...extra });

test("7/30 day plans use frequency instead of a fixed 30 topics", () => {
  assert.equal(calendar.publishingDates("2026-10-26", "2026-11-01", 1).length, 1);
  assert.equal(calendar.publishingDates("2026-10-26", "2026-11-01", 3).length, 3);
  assert.equal(calendar.publishingDates("2026-10-26", "2026-11-24", 1).length, 5);
  assert.equal(calendar.publishingDates("2026-10-26", "2026-11-24", 3).length, 13);
  assert.equal(calendar.publishingDates("2026-10-26", "2026-11-24", 14).length, 60);
  assert.ok(calendar.publishingDates("2026-10-26", "2026-11-01", 14).every(date => date <= "2026-11-01"));
});
test("new plan parsing validates periods, dates, frequency and time zones", () => {
  const parsed = parser.parsePlanGenerationOptions({ periodStart: "2026-10-26" }, account);
  assert.equal(parsed.periodEnd, "2026-11-01"); assert.equal(parsed.timeZone, "Asia/Shanghai");
  for (const bad of [{ periodDays: 8 }, { publishingFrequency: 0 }, { publishingFrequency: 1.5 }, { timeZone: "invalid" }, { periodStart: "2026-02-30" }, { periodStart: "2026-10-26", periodEnd: "2026-11-02" }]) assert.throws(() => parser.parsePlanGenerationOptions(bad, account));
});
test("local midnight uses the selected time zone, independent of server UTC", () => {
  const now = new Date("2026-10-31T16:30:00Z");
  assert.equal(calendar.localDate(now, "Asia/Shanghai"), "2026-11-01");
  assert.equal(calendar.localDate(now, "America/Los_Angeles"), "2026-10-31");
  assert.deepEqual(calendar.calendarWeek("2026-11-01"), { start: "2026-10-26", end: "2026-11-01" });
});
test("the home week advances across a month and never resets to week one", () => {
  const scheduled = { ...plan, items: [item("first", "2026-10-26"), item("second", "2026-11-02", { week: 2 })] };
  assert.deepEqual(calendar.weeklyItems(scheduled, "2026-11-03").map(item => item.id), ["second"]);
  assert.equal(calendar.planWeek(scheduled, "2026-11-03"), 2);
  assert.match(tasks.deriveTodayTask({ ...scheduled, items: [scheduled.items[1]] }, [], "2026-11-03").title, /second/);
});
test("legacy undated items remain readable with no mutation", () => {
  const legacy = { ...plan, items: [item("old", undefined, { week: 2, unknown: "preserve", updatedAt: "2026-01-01" })] };
  const before = JSON.stringify(legacy);
  assert.equal(calendar.weeklyItems(legacy, "2026-11-03").length, 1);
  tasks.deriveTodayTask(legacy, [], "2026-11-03"); tasks.getWeeklyPlanProgress(legacy, [], "2026-11-03");
  assert.equal(JSON.stringify(legacy), before);
  const outside = item("old-outside", "2026-08-01");
  assert.equal(parser.parsePlanItemPatch({ title: "修改标题", scheduledDate: outside.scheduledDate }, plan, outside).scheduledDate, outside.scheduledDate);
});
test("no-plan users continue an existing draft and can start a first article", () => {
  assert.equal(tasks.deriveTodayTask(null, [draft()], "2026-11-03").href, "/drafts/d");
  assert.equal(tasks.deriveTodayTask(null, [], "2026-11-03").href, "/setup/first-content");
});
test("generated, human approved and actually published are separate states", () => {
  const scheduled = { ...plan, items: [item("topic", "2026-11-03", { status: "generated", contentProjectId: "d" })] };
  const generated = tasks.getWeeklyPlanProgress(scheduled, [draft()], "2026-11-03");
  assert.equal(generated.generated, 1); assert.equal(generated.approved, 0); assert.equal(generated.published, 0); assert.equal(generated.completed, 0);
  assert.equal(tasks.getWeeklyPlanProgress({ ...scheduled, items: [{ ...scheduled.items[0], status: "paused" }] }, [draft()], "2026-11-03").generated, 1, "pausing a task does not erase its actual generated output");
  const approved = tasks.getWeeklyPlanProgress(scheduled, [draft({ reviewStatus: "approved" })], "2026-11-03");
  assert.equal(approved.approved, 1); assert.equal(approved.published, 0);
  const publication = { channel: "wechat_article", publishedAt: "2026-11-02T03:00:00Z" };
  assert.equal(tasks.getWeeklyPlanProgress(scheduled, [draft({ reviewStatus: "approved", publications: [publication] })], "2026-11-03").published, 1);
  assert.equal(tasks.getWeeklyPlanProgress({ ...scheduled, items: [{ ...scheduled.items[0], status: "published" }] }, [], "2026-11-03").published, 0, "a status flag is not a publication record");
});
test("failed drafts, paused tasks and missing historical links have usable next steps", () => {
  assert.match(tasks.deriveTodayTask(null, [draft({ failedChannels: ["wechat_article"], projectStatus: "failed" })], "2026-11-03").actionLabel, /重试/);
  const paused = { ...plan, items: [item("paused", "2026-11-03", { status: "paused", contentProjectId: "d" })] };
  assert.equal(tasks.deriveTodayTask(paused, [draft()], "2026-11-03").href, "/plans");
  assert.equal(tasks.planItemState(plan, item("missing", "2026-11-03", { contentProjectId: "gone" }), []).href, "/articles");
});
test("manual operational tasks can be completed without implying content publication", () => {
  const photos = item("拍门头与服务细节", "2026-11-03", { taskType: "photos", status: "completed" });
  const progress = tasks.getWeeklyPlanProgress({ ...plan, items: [photos] }, [], "2026-11-03");
  assert.equal(progress.completed, 1); assert.equal(progress.published, 0);
  assert.throws(() => parser.parseManualTask({ taskType: "content", title: "写内容", scheduledDate: "2026-11-03" }, plan));
  assert.throws(() => parser.parsePlanItemPatch({ status: "completed" }, plan, item("content", "2026-11-03")));
});
test("published content suggests feedback on the following local day", () => {
  const published = draft({ publications: [{ channel: "wechat_article", publishedAt: "2026-11-02T16:30:00Z" }] });
  assert.equal(tasks.deriveTodayTask(null, [published], "2026-11-03").href, "/setup/first-content");
  assert.equal(tasks.deriveTodayTask(null, [published], "2026-11-04").actionLabel, "登记发布反馈");
  assert.equal(tasks.deriveTodayTask(null, [published], "2026-11-03", "America/Los_Angeles").actionLabel, "登记发布反馈");
});
