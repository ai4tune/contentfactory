import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  filterAndSortSearchResults,
  xiaohongshuSearchUrl,
} from "../../extensions/contentfactory-capture/viral-search-utils.mjs";
import { buildSearchArchive } from "../../extensions/contentfactory-capture/local-archive-format.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const captureSource = await readFile(
  path.join(repositoryRoot, "extensions/contentfactory-capture/capture-search-page.js"),
  "utf8",
);
const { captureVisibleSearchResults } = await import(
  `data:text/javascript;base64,${Buffer.from(captureSource).toString("base64")}`
);

const now = new Date("2026-08-12T12:00:00.000Z");
const results = [
  { title: "三天内高赞", likes: { raw: "1.2万", value: 12_000 }, publishedAt: "2026-08-10T12:00:00.000Z" },
  { title: "七天内中赞", likes: { raw: "800", value: 800 }, publishedAt: "2026-08-07T12:00:00.000Z" },
  { title: "超过七天", likes: { raw: "2万", value: 20_000 }, publishedAt: "2026-08-01T12:00:00.000Z" },
  { title: "时间未知", likes: { raw: "5000", value: 5_000 }, publishedAt: "" },
  { title: "低赞", likes: { raw: "50", value: 50 }, publishedAt: "2026-08-12T08:00:00.000Z" },
];

test("visible search results can be filtered by 3 or 7 days and sorted by likes", () => {
  const threeDays = filterAndSortSearchResults(results, {
    days: 3,
    minimumLikes: 100,
    sort: "likes_desc",
    includeUnknownDates: false,
  }, now);
  assert.deepEqual(threeDays.map((item) => item.title), ["三天内高赞"]);

  const sevenDays = filterAndSortSearchResults(results, {
    days: 7,
    minimumLikes: 100,
    sort: "likes_desc",
    includeUnknownDates: true,
  }, now);
  assert.deepEqual(sevenDays.map((item) => item.title), ["三天内高赞", "时间未知", "七天内中赞"]);
});

test("Xiaohongshu keyword links are encoded and search sessions are portable", () => {
  const url = xiaohongshuSearchUrl("AI 企业落地 真实案例");
  assert.equal(new URL(url).searchParams.get("keyword"), "AI 企业落地 真实案例");

  const archive = buildSearchArchive({
    platform: "小红书",
    query: "AI 企业落地 真实案例",
    sourceUrl: url,
    capturedAt: "2026-08-12T12:00:00.000Z",
    filters: { days: 7, minimumLikes: 100, sort: "likes_desc" },
    results: [{
      title: "企业第一次做 AI",
      url: "https://www.xiaohongshu.com/search_result/demo?xsec_token=temporary&xsec_source=pc_search",
      canonicalUrl: "https://www.xiaohongshu.com/explore/demo",
      author: "杏仁聊AI",
      likes: { raw: "1200", value: 1200 },
      publishedText: "2天前",
    }],
  });
  assert.deepEqual(archive.directorySegments, ["内容工厂采集", "搜索任务", "2026-08"]);
  assert.match(archive.markdown, /爆款搜索：AI 企业落地 真实案例/);
  assert.match(archive.markdown, /点赞：1200/);
  assert.doesNotMatch(archive.markdown, /xsec_token/);
  const record = JSON.parse(archive.json);
  assert.equal(record.schema, "contentfactory.search-session.v1");
  assert.equal(record.results[0].url, "https://www.xiaohongshu.com/explore/demo");
  assert.doesNotMatch(archive.json, /xsec_token/);
});

test("visible Xiaohongshu cards keep navigation tokens, canonical URL, and one time reference aligned", () => {
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const RealDate = globalThis.Date;
  const fixedNow = new RealDate("2026-08-12T12:00:00.000Z").getTime();
  let clockReads = 0;
  class TickingDate extends RealDate {
    constructor(value) {
      if (arguments.length) super(value);
      else super(fixedNow + clockReads++ * 10);
    }
  }
  const nodes = {
    title: { textContent: "企业 AI 落地复盘" },
    likes: { textContent: "1.8万" },
    author: { textContent: "杏仁聊AI" },
    time: { textContent: "3天前" },
    image: { currentSrc: "https://ci.xiaohongshu.com/demo.jpg", src: "" },
  };
  const root = {
    textContent: "企业 AI 落地复盘 杏仁聊AI 3天前 1.8万",
    querySelector(selector) {
      if (selector.includes("footer")) return nodes.title;
      if (selector.includes("like-wrapper")) return nodes.likes;
      if (selector.includes("author")) return nodes.author;
      if (selector.startsWith("time")) return nodes.time;
      if (selector === "img") return nodes.image;
      return null;
    },
  };
  const link = {
    href: "https://www.xiaohongshu.com/search_result/note-001?xsec_token=temporary&xsec_source=pc_search",
    parentElement: root,
    closest() { return root; },
    getAttribute() { return null; },
    querySelector() { return nodes.image; },
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector.includes("input")) return { value: "AI 企业落地" };
      return null;
    },
    querySelectorAll() { return [link]; },
  };
  globalThis.location = {
    href: "https://www.xiaohongshu.com/search_result?keyword=AI%20%E4%BC%81%E4%B8%9A%E8%90%BD%E5%9C%B0",
  };
  globalThis.Date = TickingDate;

  try {
    const capture = captureVisibleSearchResults();
    globalThis.Date = RealDate;
    assert.equal(capture.query, "AI 企业落地");
    assert.equal(capture.results.length, 1);
    assert.deepEqual(capture.results[0], {
      noteId: "note-001",
      title: "企业 AI 落地复盘",
      author: "杏仁聊AI",
      url: "https://www.xiaohongshu.com/search_result/note-001?xsec_token=temporary&xsec_source=pc_search",
      canonicalUrl: "https://www.xiaohongshu.com/explore/note-001",
      coverUrl: "https://ci.xiaohongshu.com/demo.jpg",
      likes: { raw: "1.8万", value: 18_000 },
      publishedAt: capture.results[0].publishedAt,
      publishedText: "3天前",
    });
    assert.ok(capture.results[0].publishedAt);
    assert.equal(clockReads, 1);
    const boundaryResults = filterAndSortSearchResults(capture.results, {
      days: 3,
      minimumLikes: 100,
      sort: "likes_desc",
      includeUnknownDates: false,
    }, new RealDate(capture.capturedAt));
    assert.equal(boundaryResults.length, 1);
  } finally {
    globalThis.Date = RealDate;
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
  }
});
