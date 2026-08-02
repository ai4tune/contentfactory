import { captureVisibleAccountPage } from "./capture-page.js";

const DEFAULT_BASE_URL = "http://localhost:3000";

const elements = {
  accessToken: document.getElementById("accessToken"),
  accountName: document.getElementById("accountName"),
  analyze: document.getElementById("analyze"),
  baseUrl: document.getElementById("baseUrl"),
  bio: document.getElementById("bio"),
  capture: document.getElementById("capture"),
  captureMeta: document.getElementById("captureMeta"),
  captureMetrics: document.getElementById("captureMetrics"),
  capturePreview: document.getElementById("capturePreview"),
  confirm: document.getElementById("confirm"),
  contentList: document.getElementById("contentList"),
  draftAudience: document.getElementById("draftAudience"),
  draftBusiness: document.getElementById("draftBusiness"),
  draftDirections: document.getElementById("draftDirections"),
  draftOffer: document.getElementById("draftOffer"),
  draftPillars: document.getElementById("draftPillars"),
  draftPosition: document.getElementById("draftPosition"),
  draftPreview: document.getElementById("draftPreview"),
  draftTopics: document.getElementById("draftTopics"),
  draftVoice: document.getElementById("draftVoice"),
  followerCount: document.getElementById("followerCount"),
  inspirationContent: document.getElementById("inspirationContent"),
  inspirationDirection: document.getElementById("inspirationDirection"),
  inspirationKeyword: document.getElementById("inspirationKeyword"),
  inspirationMedia: document.getElementById("inspirationMedia"),
  inspirationMetrics: document.getElementById("inspirationMetrics"),
  inspirationPreview: document.getElementById("inspirationPreview"),
  inspirationSource: document.getElementById("inspirationSource"),
  inspirationTarget: document.getElementById("inspirationTarget"),
  inspirationTitle: document.getElementById("inspirationTitle"),
  openInspiration: document.getElementById("openInspiration"),
  saveSettings: document.getElementById("saveSettings"),
  saveInspiration: document.getElementById("saveInspiration"),
  status: document.getElementById("status"),
};

let capturedAccount = null;
let capturedInspiration = null;
let positioningDraft = null;
let savedInspirationUrl = "";

initialize();

elements.saveSettings.addEventListener("click", saveSettings);
elements.capture.addEventListener("click", captureCurrentPage);
elements.analyze.addEventListener("click", analyzeCapture);
elements.confirm.addEventListener("click", confirmPositioning);
elements.saveInspiration.addEventListener("click", saveInspiration);
elements.openInspiration.addEventListener("click", openSavedInspiration);

async function initialize() {
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL, accessToken: "" });
  elements.baseUrl.value = settings.baseUrl;
  elements.accessToken.value = settings.accessToken;
  elements.inspirationTarget.textContent = `目标爆款库：${normalizeBaseUrl(settings.baseUrl)}/inspirations`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const path = tab?.url ? new URL(tab.url).pathname.toLowerCase() : "";
  elements.capture.textContent = path.includes("/user/profile/")
    ? "采集当前账号"
    : path.includes("/explore/") || path.includes("/discovery/item/")
      ? "采集当前笔记到爆款库"
      : "识别并采集当前页面";
}

async function saveSettings() {
  setBusy(elements.saveSettings, true, "正在授权…");
  try {
    const baseUrl = normalizeBaseUrl(elements.baseUrl.value);
    const permission = permissionPattern(baseUrl);
    const granted = await chrome.permissions.request({ origins: [permission] });
    if (!granted) throw new Error("未授予访问该内容工厂地址的权限");
    await chrome.storage.local.set({ baseUrl, accessToken: elements.accessToken.value.trim() });
    elements.baseUrl.value = baseUrl;
    elements.inspirationTarget.textContent = `目标爆款库：${baseUrl}/inspirations`;
    showStatus("连接设置已保存。", "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.saveSettings, false, "保存并授权该地址");
  }
}

async function captureCurrentPage() {
  setBusy(elements.capture, true, "正在读取可见信息…");
  showStatus("正在采集当前页面可见的账号与作品信息…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("没有找到当前标签页");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureVisibleAccountPage,
    });
    if (result?.platform === "小红书" && result.pageType === "content") {
      const note = result.contents?.[0];
      if (!note?.title) throw new Error("没有识别到笔记标题，请刷新笔记详情页后重试");
      if (!note?.description) throw new Error("没有识别到笔记正文，请展开完整正文或刷新页面后重试");
      capturedAccount = null;
      capturedInspiration = { capture: result, note };
      positioningDraft = null;
      renderInspiration(result, note);
      elements.capturePreview.hidden = true;
      elements.draftPreview.hidden = true;
      showStatus("已读取当前笔记。请核对标题、正文和指标，再保存到爆款库。", "success");
      return;
    }
    if (result?.platform === "小红书" && result.pageType !== "account") {
      throw new Error("当前页面不支持。请打开小红书“我”的主页或一篇笔记详情");
    }
    if (!result?.accountName) throw new Error("未识别到账号名称，请确认当前打开的是账号主页");
    capturedAccount = result;
    capturedInspiration = null;
    positioningDraft = null;
    renderCapture(result);
    elements.inspirationPreview.hidden = true;
    elements.draftPreview.hidden = true;
    showStatus("已采集。请先检查可见信息，确认后再进行 AI 定位。", "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.capture, false, "重新采集当前页面");
  }
}

async function saveInspiration() {
  if (!capturedInspiration) return;
  setBusy(elements.saveInspiration, true, "正在保存并拆解…");
  elements.openInspiration.hidden = true;
  try {
    const { capture, note } = capturedInspiration;
    const title = elements.inspirationTitle.value.trim();
    const content = elements.inspirationContent.value.trim();
    if (!title) throw new Error("标题不能为空");
    if (!content) throw new Error("正文不能为空");
    const data = await callApi("/api/capture/import", {
      platform: capture.platform,
      sourceUrl: note.url || capture.sourceUrl,
      platformContentId: note.noteId,
      title,
      content,
      contentType: note.type,
      tags: note.tags || [],
      imageUrls: note.imageUrls || [],
      coverUrl: note.coverUrl,
      publishedAt: note.publishedAt,
      capturedAt: capture.capturedAt,
      author: note.author || { name: capture.accountName },
      metrics: note.metrics || {},
      metricsSummary: note.metricSummary,
      sourceKeyword: elements.inspirationKeyword.value.trim(),
      contentDirection: elements.inspirationDirection.value.trim(),
    });
    savedInspirationUrl = `/inspirations/${data.record.id}`;
    elements.openInspiration.hidden = false;
    const operation = data.operation === "updated" ? "已存在并更新" : "新增成功";
    showStatus(`${operation}：${data.record.content.title}\n可以打开详情查看 AI 拆解。`, "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.saveInspiration, false, "保存并生成 AI 拆解");
  }
}

async function openSavedInspiration() {
  if (!savedInspirationUrl) return;
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL });
  await chrome.tabs.create({ url: `${normalizeBaseUrl(settings.baseUrl)}${savedInspirationUrl}` });
}

async function analyzeCapture() {
  if (!capturedAccount) return;
  setBusy(elements.analyze, true, "AI 正在分析…");
  try {
    capturedAccount = {
      ...capturedAccount,
      accountName: elements.accountName.value.trim(),
      bio: elements.bio.value.trim(),
      followerCount: elements.followerCount.value.trim(),
    };
    if (!capturedAccount.accountName) throw new Error("账号名称不能为空");
    const data = await callCaptureApi({ action: "analyze", capture: capturedAccount });
    positioningDraft = data.draft;
    renderDraft(positioningDraft);
    showStatus("AI 定位预览已生成，尚未覆盖当前账号。", "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.analyze, false, "确认采集并生成 AI 定位预览");
  }
}

async function confirmPositioning() {
  if (!positioningDraft) return;
  setBusy(elements.confirm, true, "正在保存…");
  try {
    const business = elements.draftBusiness.value.trim();
    const offer = elements.draftOffer.value.trim();
    positioningDraft = {
      ...positioningDraft,
      source: "capture",
      business,
      offer,
      accountPosition: elements.draftPosition.value.trim(),
      targetAudience: lines(elements.draftAudience.value),
      contentPillars: lines(elements.draftPillars.value),
      brandVoice: lines(elements.draftVoice.value),
      contentDirections: lines(elements.draftDirections.value),
      recommendedTopics: lines(elements.draftTopics.value),
      input: { ...positioningDraft.input, business, offer },
    };
    const data = await callCaptureApi({ action: "confirm", draft: positioningDraft });
    showStatus(`已覆盖当前账号：${data.context.accountName}\n打开内容工厂即可使用新定位。`, "success");
    elements.confirm.disabled = true;
    elements.confirm.textContent = "已保存当前账号";
  } catch (error) {
    showError(error);
  } finally {
    if (!elements.confirm.disabled) setBusy(elements.confirm, false, "确认并覆盖当前账号");
  }
}

async function callCaptureApi(body) {
  return callApi("/api/capture/account", body);
}

async function callApi(path, body) {
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL, accessToken: "" });
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const headers = { "Content-Type": "application/json" };
  if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `内容工厂返回 ${response.status}`);
  return data;
}

function renderCapture(capture) {
  elements.accountName.value = capture.accountName;
  elements.bio.value = capture.bio;
  elements.followerCount.value = capture.followerCount;
  elements.captureMeta.textContent = `${capture.platform} · ${pageTypeLabel(capture.pageType)}\n${capture.sourceUrl}`;
  elements.captureMetrics.replaceChildren(...metricRows(capture));
  elements.contentList.replaceChildren(...capture.contents.slice(0, 12).map((item) => {
    const row = document.createElement("li");
    const detail = [item.type === "video" ? "视频" : item.type === "image" ? "图文" : "", item.metricSummary]
      .filter(Boolean).join(" · ");
    row.textContent = `${item.title}${detail ? ` · ${detail}` : ""}`;
    return row;
  }));
  if (!capture.contents.length) {
    const row = document.createElement("li");
    row.textContent = "当前页面未识别到内容列表，仍可基于账号简介分析。";
    elements.contentList.append(row);
  }
  elements.capturePreview.hidden = false;
}

function renderInspiration(capture, note) {
  savedInspirationUrl = "";
  elements.inspirationTitle.value = note.title || "";
  elements.inspirationContent.value = note.description || "";
  elements.inspirationKeyword.value = "";
  elements.inspirationDirection.value = "";
  elements.inspirationSource.textContent = [
    `${capture.platform} · ${note.type === "video" ? "视频" : "图文"}`,
    note.author?.name ? `作者：${note.author.name}` : "作者未识别",
    note.publishedAt ? `发布：${formatDate(note.publishedAt)}` : "发布时间未公开",
  ].join("\n");
  elements.inspirationMetrics.replaceChildren(...contentMetricRows(note.metrics));
  elements.inspirationMedia.textContent = `图片 ${note.imageUrls?.length || 0} 张 · ${note.url || capture.sourceUrl}`;
  elements.openInspiration.hidden = true;
  elements.inspirationPreview.hidden = false;
}

function contentMetricRows(metrics = {}) {
  return [
    ["点赞", metrics.likes],
    ["收藏", metrics.collects],
    ["评论", metrics.comments],
    ["分享", metrics.shares],
    ["阅读/播放", metrics.views],
  ].map(([label, value]) => {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const number = document.createElement("strong");
    name.textContent = label;
    number.textContent = value?.raw || (Number.isFinite(value?.value) ? String(value.value) : "当前页面未公开");
    if (!value || value.value === null) item.className = "missing";
    item.append(name, number);
    return item;
  });
}

function metricRows(capture) {
  const rows = [
    ["关注", capture.accountMetrics?.following],
    ["粉丝", capture.accountMetrics?.followers],
    ["获赞与收藏", capture.accountMetrics?.likesAndCollects],
    ["阅读/播放", capture.operationalMetrics?.views],
    ["曝光", capture.operationalMetrics?.impressions],
    ["主页访问", capture.operationalMetrics?.profileVisits],
    ["新增粉丝", capture.operationalMetrics?.followerGrowth],
  ];
  return rows.map(([label, value]) => {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const number = document.createElement("strong");
    name.textContent = label;
    number.textContent = value?.raw || "当前页面未公开";
    if (!value) item.className = "missing";
    item.append(name, number);
    return item;
  });
}

function renderDraft(draft) {
  elements.draftBusiness.value = draft.business || "";
  elements.draftOffer.value = draft.offer || "";
  elements.draftPosition.value = draft.accountPosition || "";
  elements.draftAudience.value = (draft.targetAudience || []).join("\n");
  elements.draftPillars.value = (draft.contentPillars || []).join("\n");
  elements.draftVoice.value = (draft.brandVoice || []).join("\n");
  elements.draftDirections.value = (draft.contentDirections || []).join("\n");
  elements.draftTopics.value = (draft.recommendedTopics || []).join("\n");
  elements.draftPreview.hidden = false;
  elements.draftPreview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("内容工厂地址必须使用 http 或 https");
  return url.origin + url.pathname.replace(/\/+$/, "");
}

function permissionPattern(baseUrl) {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.hostname}/*`;
}

function lines(value) {
  return String(value).split("\n").map((item) => item.trim()).filter(Boolean);
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function showStatus(message, type = "") {
  elements.status.className = type;
  elements.status.textContent = message;
}

function showError(error) {
  showStatus(`操作失败：${error instanceof Error ? error.message : String(error)}`, "error");
}

function pageTypeLabel(type) {
  return { account: "账号主页", creator_backend: "创作者后台", content: "内容页", unknown: "未知页面" }[type] || "未知页面";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
