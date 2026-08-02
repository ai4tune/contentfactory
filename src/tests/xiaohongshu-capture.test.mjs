import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(
  path.join(repositoryRoot, "extensions/contentfactory-capture/capture-page.js"),
  "utf8",
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { captureVisibleAccountPage } = await import(moduleUrl);

test("Xiaohongshu note capture keeps visible content, author, media, and metrics aligned", () => {
  const initialState = {
    note: {
      noteDetailMap: {
        "note-001": {
          note: {
            noteId: "note-001",
            title: "企业 AI 落地先做什么",
            desc: "先确认经营目标，再选择一个真实场景完成试点。",
            type: "normal",
            time: 1_785_600_000_000,
            tagList: [{ name: "AI企业落地" }, { name: "智能体" }],
            imageList: [
              { urlDefault: "https://ci.xiaohongshu.com/cover.jpg" },
              { urlDefault: "https://ci.xiaohongshu.com/page-2.jpg" },
            ],
            interactInfo: {
              likedCount: "1.2万",
              collectedCount: "3680",
              commentCount: "96",
              shareCount: "28",
            },
            user: {
              userId: "author-001",
              nickname: "杏仁聊AI",
            },
          },
        },
      },
    },
  };

  const stateScript = { textContent: JSON.stringify(initialState) };
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = {
    body: { innerText: "企业 AI 落地先做什么" },
    scripts: [],
    querySelector(selector) {
      if (selector === "script#__INITIAL_STATE__, script[id*='INITIAL_STATE']") return stateScript;
      return null;
    },
    querySelectorAll() { return []; },
  };
  globalThis.location = {
    hostname: "www.xiaohongshu.com",
    pathname: "/explore/note-001",
    origin: "https://www.xiaohongshu.com",
    href: "https://www.xiaohongshu.com/explore/note-001?xsec_token=temporary",
  };

  try {
    const capture = captureVisibleAccountPage();
    const note = capture.contents[0];
    assert.equal(capture.pageType, "content");
    assert.equal(capture.sourceUrl, "https://www.xiaohongshu.com/explore/note-001");
    assert.equal(note.title, "企业 AI 落地先做什么");
    assert.equal(note.description, "先确认经营目标，再选择一个真实场景完成试点。");
    assert.equal(note.author.name, "杏仁聊AI");
    assert.equal(note.author.platformAuthorId, "author-001");
    assert.deepEqual(note.tags, ["AI企业落地", "智能体"]);
    assert.equal(note.imageUrls.length, 2);
    assert.equal(note.metrics.likes.value, 12_000);
    assert.equal(note.metrics.collects.value, 3_680);
    assert.equal(note.metrics.comments.value, 96);
    assert.equal(note.metrics.shares.value, 28);
  } finally {
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
  }
});
