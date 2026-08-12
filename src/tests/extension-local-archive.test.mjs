import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalArchive,
  safeFileName,
} from "../../extensions/contentfactory-capture/local-archive-format.mjs";

test("account capture becomes an interoperable Markdown and JSON pair", () => {
  const archive = buildLocalArchive({
    platform: "小红书",
    pageType: "account",
    sourceUrl: "https://www.xiaohongshu.com/user/profile/demo",
    platformDisplayId: "杏仁聊AI",
    accountName: "杏仁聊AI",
    bio: "AI 工具与企业落地",
    capturedAt: "2026-08-12T10:20:30.000Z",
    accountMetrics: {
      following: { raw: "20", value: 20 },
      followers: { raw: "29", value: 29 },
      likesAndCollects: { raw: "332", value: 332 },
    },
    contents: [{ title: "普通人如何用 AI", url: "https://example.com/1", metricSummary: "点赞 88" }],
  });

  assert.equal(archive.kind, "account");
  assert.deepEqual(archive.directorySegments, ["内容工厂采集", "账号"]);
  assert.match(archive.baseName, /^2026-08-12-杏仁聊AI-/);
  assert.match(archive.markdown, /# 杏仁聊AI/);
  assert.match(archive.markdown, /粉丝：29/);
  assert.match(archive.markdown, /\[普通人如何用 AI\]\(https:\/\/example.com\/1\)/);
  assert.equal(JSON.parse(archive.json).schema, "contentfactory.capture.v1");
});

test("note capture goes to a monthly viral archive and keeps body and images", () => {
  const archive = buildLocalArchive({
    platform: "小红书",
    pageType: "content",
    sourceUrl: "https://www.xiaohongshu.com/explore/abc",
    accountName: "作者",
    capturedAt: "2026-08-12T10:20:30.000Z",
    contents: [{
      noteId: "abc",
      title: "一篇爆款/笔记",
      description: "这是正文。",
      type: "image",
      url: "https://www.xiaohongshu.com/explore/abc",
      tags: ["AI工具"],
      imageUrls: ["https://img.example.com/1.jpg"],
      metrics: { likes: { raw: "1.2万", value: 12000 } },
    }],
  });

  assert.equal(archive.kind, "inspiration");
  assert.deepEqual(archive.directorySegments, ["内容工厂采集", "爆款", "2026-08"]);
  assert.match(archive.baseName, /^2026-08-12-一篇爆款-笔记-/);
  assert.match(archive.markdown, /这是正文。/);
  assert.match(archive.markdown, /#AI工具/);
  assert.match(archive.markdown, /!\[图片 1\]\(https:\/\/img.example.com\/1.jpg\)/);
});

test("file names remove characters rejected by common file systems", () => {
  assert.equal(safeFileName(' A/B:C*D?"E<F>G| '), "A-B-C-D--E-F-G-");
});
