const ARCHIVE_SCHEMA = "contentfactory.capture.v1";

export function buildLocalArchive(capture, now = new Date()) {
  const kind = capture?.pageType === "content" ? "inspiration" : "account";
  const capturedAt = validIso(capture?.capturedAt) || now.toISOString();
  const date = capturedAt.slice(0, 10);
  const month = capturedAt.slice(0, 7);
  const title = kind === "inspiration"
    ? capture?.contents?.[0]?.title || "未命名爆款"
    : capture?.accountName || "未命名账号";
  const sourceId = kind === "inspiration"
    ? capture?.contents?.[0]?.noteId || capture?.contents?.[0]?.url || capture?.sourceUrl
    : capture?.platformAccountId || capture?.platformDisplayId || capture?.sourceUrl;
  const baseName = `${date}-${safeFileName(title)}-${shortHash(sourceId || title)}`;
  const directorySegments = kind === "inspiration"
    ? ["内容工厂采集", "爆款", month]
    : ["内容工厂采集", "账号"];
  const record = {
    schema: ARCHIVE_SCHEMA,
    kind,
    capturedAt,
    platform: capture?.platform || "",
    sourceUrl: capture?.sourceUrl || "",
    capture,
  };

  return {
    kind,
    baseName,
    directorySegments,
    markdown: kind === "inspiration"
      ? renderInspirationMarkdown(record)
      : renderAccountMarkdown(record),
    json: `${JSON.stringify(record, null, 2)}\n`,
  };
}

export function safeFileName(value) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 72);
  return cleaned || "未命名";
}

function renderAccountMarkdown(record) {
  const capture = record.capture || {};
  const metrics = capture.accountMetrics || {};
  const contents = Array.isArray(capture.contents) ? capture.contents : [];
  const lines = [
    frontmatter(record, capture.accountName || "未命名账号"),
    `# ${escapeHeading(capture.accountName || "未命名账号")}`,
    "",
    "## 账号信息",
    "",
    `- 平台：${capture.platform || "未识别"}`,
    `- 平台账号 ID：${capture.platformDisplayId || capture.platformAccountId || "未公开"}`,
    `- 来源：[打开原页面](${capture.sourceUrl || ""})`,
    `- 采集时间：${record.capturedAt}`,
    `- 简介：${capture.bio || "未填写"}`,
    capture.verification ? `- 认证：${capture.verification}` : "",
    "",
    "## 公开指标",
    "",
    metricLine("关注", metrics.following),
    metricLine("粉丝", metrics.followers),
    metricLine("获赞与收藏", metrics.likesAndCollects),
    "",
    "## 当前可见作品",
    "",
    ...(contents.length ? contents.map(renderContentRow) : ["当前页面未识别到作品列表。"]),
    "",
    "## 使用说明",
    "",
    "同名 JSON 文件保留完整结构化字段，适合 Codex、WorkBuddy 或其他自动化工具读取。",
  ];
  return `${lines.filter((line) => line !== "").join("\n\n").replace(/\n\n- /g, "\n- ")}\n`;
}

function renderInspirationMarkdown(record) {
  const capture = record.capture || {};
  const note = capture.contents?.[0] || {};
  const metrics = note.metrics || {};
  const lines = [
    frontmatter(record, note.title || "未命名爆款"),
    `# ${escapeHeading(note.title || "未命名爆款")}`,
    "",
    "## 来源信息",
    "",
    `- 平台：${capture.platform || "未识别"}`,
    note.author?.name || capture.accountName ? `- 作者：${note.author?.name || capture.accountName}` : "",
    `- 原文：[打开原页面](${note.url || capture.sourceUrl || ""})`,
    `- 发布时间：${note.publishedAt || "页面未公开"}`,
    `- 采集时间：${record.capturedAt}`,
    `- 类型：${note.type === "video" ? "视频" : note.type === "image" ? "图文" : "未识别"}`,
    "",
    "## 公开指标",
    "",
    metricLine("点赞", metrics.likes),
    metricLine("收藏", metrics.collects),
    metricLine("评论", metrics.comments),
    metricLine("分享", metrics.shares),
    metricLine("阅读/播放", metrics.views),
    "",
    "## 正文",
    "",
    note.description || "当前页面未识别到正文。",
    "",
    "## 标签",
    "",
    (note.tags || []).length ? note.tags.map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" ") : "页面未识别到标签。",
    "",
    "## 图片",
    "",
    ...(note.imageUrls || []).length
      ? note.imageUrls.map((url, index) => `![图片 ${index + 1}](${url})`)
      : ["当前页面未识别到图片。"],
    "",
    "## 使用说明",
    "",
    "同名 JSON 文件保留完整结构化字段，适合 Codex、WorkBuddy 或其他自动化工具读取。",
  ];
  return `${lines.filter((line) => line !== "").join("\n\n").replace(/\n\n- /g, "\n- ")}\n`;
}

function frontmatter(record, title) {
  return [
    "---",
    `schema: ${ARCHIVE_SCHEMA}`,
    `kind: ${record.kind}`,
    `title: ${yamlString(title)}`,
    `platform: ${yamlString(record.platform)}`,
    `source_url: ${yamlString(record.sourceUrl)}`,
    `captured_at: ${yamlString(record.capturedAt)}`,
    "---",
  ].join("\n");
}

function metricLine(label, metric) {
  return `- ${label}：${metric?.raw || "页面未公开"}`;
}

function renderContentRow(content) {
  const title = escapeInline(content?.title || "未命名作品");
  const suffix = content?.metricSummary ? ` — ${escapeInline(content.metricSummary)}` : "";
  return content?.url ? `- [${title}](${content.url})${suffix}` : `- ${title}${suffix}`;
}

function validIso(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function escapeHeading(value) {
  return String(value || "").replace(/\n/g, " ").trim();
}

function escapeInline(value) {
  return String(value || "").replace(/[\[\]|]/g, (char) => `\\${char}`);
}

function shortHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}
