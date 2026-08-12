import { captureVisibleAccountPage } from "./capture-page.js";
import { captureVisibleSearchResults } from "./capture-search-page.js";
import {
  chooseLocalArchiveDirectory,
  getLocalArchiveStatus,
  saveCaptureLocally,
  saveSearchSessionLocally,
} from "./local-archive.js";
import { filterAndSortSearchResults, xiaohongshuSearchUrl } from "./viral-search-utils.mjs";

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
  chooseLocalArchive: document.getElementById("chooseLocalArchive"),
  confirm: document.getElementById("confirm"),
  captureSearchResults: document.getElementById("captureSearchResults"),
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
  inspirationImages: document.getElementById("inspirationImages"),
  inspirationKeyword: document.getElementById("inspirationKeyword"),
  inspirationMedia: document.getElementById("inspirationMedia"),
  inspirationMetrics: document.getElementById("inspirationMetrics"),
  inspirationPreview: document.getElementById("inspirationPreview"),
  inspirationSource: document.getElementById("inspirationSource"),
  inspirationTags: document.getElementById("inspirationTags"),
  inspirationTitle: document.getElementById("inspirationTitle"),
  localArchiveStatus: document.getElementById("localArchiveStatus"),
  includeUnknownDates: document.getElementById("includeUnknownDates"),
  keywordList: document.getElementById("keywordList"),
  minimumLikes: document.getElementById("minimumLikes"),
  openInspiration: document.getElementById("openInspiration"),
  saveDestination: document.getElementById("saveDestination"),
  saveInspiration: document.getElementById("saveInspiration"),
  saveLocal: document.getElementById("saveLocal"),
  saveSearchLocal: document.getElementById("saveSearchLocal"),
  saveSettings: document.getElementById("saveSettings"),
  searchDays: document.getElementById("searchDays"),
  searchResultList: document.getElementById("searchResultList"),
  searchSort: document.getElementById("searchSort"),
  searchSummary: document.getElementById("searchSummary"),
  searchWorkbench: document.getElementById("searchWorkbench"),
  recommendKeywords: document.getElementById("recommendKeywords"),
  status: document.getElementById("status"),
};

let capturedAccount = null;
let capturedInspiration = null;
let positioningDraft = null;
let savedInspirationUrl = "";
let searchSession = null;

initialize();

elements.saveSettings.addEventListener("click", saveSettings);
elements.capture.addEventListener("click", captureCurrentPage);
elements.chooseLocalArchive.addEventListener("click", chooseArchiveDirectory);
elements.saveLocal.addEventListener("click", saveCurrentCaptureLocally);
elements.analyze.addEventListener("click", analyzeCapture);
elements.confirm.addEventListener("click", confirmPositioning);
elements.saveInspiration.addEventListener("click", saveInspiration);
elements.openInspiration.addEventListener("click", openSavedInspiration);
elements.recommendKeywords.addEventListener("click", recommendKeywords);
elements.captureSearchResults.addEventListener("click", captureSearchResults);
elements.saveSearchLocal.addEventListener("click", saveSearchLocally);

async function initialize() {
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL, accessToken: "" });
  elements.baseUrl.value = settings.baseUrl;
  elements.accessToken.value = settings.accessToken;
  const archiveStatus = await refreshArchiveStatus();
  elements.saveDestination.value = archiveStatus?.configured ? "both" : "website";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const path = tab?.url ? new URL(tab.url).pathname.toLowerCase() : "";
  const isSearchPage = path.includes("/search_result");
  elements.searchWorkbench.hidden = !(isSearchPage || tab?.url?.includes("xiaohongshu.com"));
  elements.capture.textContent = path.includes("/user/profile/")
    ? "采集当前账号"
    : path.includes("/explore/") || path.includes("/discovery/item/")
      ? "预览当前笔记"
      : isSearchPage ? "采集当前搜索结果"
      : "识别并采集当前页面";
}

async function recommendKeywords() {
  setBusy(elements.recommendKeywords, true, "AI 正在生成…");
  try {
    const data = await callApi("/api/topics/search-plan", {});
    renderKeywords(data.plan.keywords || []);
    showStatus(`已根据“${data.plan.accountName}”的定位生成 ${data.plan.keywords.length} 个长尾词。`, "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.recommendKeywords, false, "根据当前定位再推荐一批");
  }
}

function renderKeywords(keywords) {
  elements.keywordList.replaceChildren(...keywords.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.query;
    button.title = item.why || "打开小红书搜索";
    button.addEventListener("click", async () => {
      await chrome.tabs.create({ url: xiaohongshuSearchUrl(item.query) });
    });
    return button;
  }));
}

async function captureSearchResults() {
  setBusy(elements.captureSearchResults, true, "正在读取已加载结果…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes("xiaohongshu.com/search_result")) {
      throw new Error("请先打开小红书搜索结果页，并滚动加载希望分析的内容");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureVisibleSearchResults,
    });
    const filters = {
      days: Number(elements.searchDays.value),
      minimumLikes: Number(elements.minimumLikes.value),
      sort: elements.searchSort.value,
      includeUnknownDates: elements.includeUnknownDates.checked,
    };
    const filtered = filterAndSortSearchResults(result?.results || [], filters);
    searchSession = { ...result, filters, results: filtered };
    renderSearchResults(searchSession, result?.results?.length || 0);
    showStatus(`已读取 ${result?.results?.length || 0} 条已加载结果，筛选出 ${filtered.length} 条。`, "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.captureSearchResults, false, "采集并筛选当前搜索结果");
  }
}

function renderSearchResults(session, total) {
  const unknownDates = session.results.filter((item) => !item.publishedAt).length;
  elements.searchSummary.textContent = [
    `关键词：${session.query || "未识别"}`,
    `当前页面已加载 ${total} 条 · 筛选后 ${session.results.length} 条`,
    unknownDates ? `其中 ${unknownDates} 条发布时间未知` : "发布时间均已识别",
  ].join("\n");
  elements.searchSummary.hidden = false;
  elements.searchResultList.replaceChildren(...session.results.map((item) => {
    const row = document.createElement("article");
    row.className = "search-result";
    const image = document.createElement("img");
    image.src = item.coverUrl || "";
    image.alt = "";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = `${item.author || "作者未识别"} · 点赞 ${item.likes?.raw || item.likes?.value || "未公开"} · ${item.publishedText || "时间未知"}`;
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "打开详情并保存 →";
    body.append(title, meta, link);
    row.append(image, body);
    return row;
  }));
  elements.saveSearchLocal.hidden = false;
}

async function saveSearchLocally() {
  if (!searchSession) return;
  setBusy(elements.saveSearchLocal, true, "正在写入本地…");
  try {
    const saved = await saveSearchSessionLocally(searchSession);
    showStatus(`搜索清单已保存\n${saved.rootName}/${saved.relativePath}`, "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.saveSearchLocal, false, "保存搜索清单到本地知识库");
  }
}

async function chooseArchiveDirectory() {
  setBusy(elements.chooseLocalArchive, true, "正在选择…");
  try {
    const status = await chooseLocalArchiveDirectory();
    renderArchiveStatus(status);
    if (elements.saveDestination.value === "website") elements.saveDestination.value = "both";
    showStatus(`已连接本地资料库：${status.name}`, "success");
  } catch (error) {
    if (error?.name !== "AbortError") showError(error);
  } finally {
    setBusy(elements.chooseLocalArchive, false, "更换本地资料库文件夹");
  }
}

async function saveCurrentCaptureLocally() {
  if (!capturedAccount) return;
  setBusy(elements.saveLocal, true, "正在写入本地…");
  try {
    capturedAccount = editedCapture();
    const saved = await saveCaptureLocally(capturedAccount);
    showStatus(`已保存 Markdown + JSON\n${saved.rootName}/${saved.relativePath}`, "success");
    await refreshArchiveStatus();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.saveLocal, false, "保存账号到本地资料库");
  }
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
    if (tab.url?.includes("xiaohongshu.com/search_result")) {
      await captureSearchResults();
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureVisibleAccountPage,
    });
    if (result?.platform === "小红书" && result.pageType === "content") {
      const note = result.contents?.[0];
      if (!note?.title) throw new Error("没有识别到笔记标题，请刷新笔记详情页后重试");
      capturedAccount = null;
      capturedInspiration = { capture: result, note };
      positioningDraft = null;
      renderInspiration(result, note);
      elements.capturePreview.hidden = true;
      elements.draftPreview.hidden = true;
      showStatus("已读取当前笔记。请核对正文、指标和图片，再选择保存位置。", "success");
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
  const destination = elements.saveDestination.value;
  let noteCapture;
  try {
    noteCapture = editedInspirationCapture();
  } catch (error) {
    showError(error);
    return;
  }
  setBusy(elements.saveInspiration, true, destination === "local" ? "正在写入本地…" : "正在保存并拆解…");
  elements.openInspiration.hidden = true;
  let websiteSaved = false;
  let localSaved = false;
  let websiteError = null;
  let localError = null;
  if (destination === "local" || destination === "both") {
    try {
      await saveCaptureLocally(noteCapture);
      localSaved = true;
      await refreshArchiveStatus();
    } catch (error) {
      localError = error;
    }
  }
  if (destination === "website" || destination === "both") {
    try {
      const note = noteCapture.contents[0];
      const data = await callApi("/api/capture/import", {
        platform: noteCapture.platform,
        sourceUrl: note.url || noteCapture.sourceUrl,
        platformContentId: note.noteId,
        title: note.title,
        content: note.description,
        contentType: note.type,
        tags: note.tags || [],
        imageUrls: note.imageUrls || [],
        coverUrl: note.coverUrl,
        publishedAt: note.publishedAt,
        capturedAt: noteCapture.capturedAt,
        author: note.author || { name: noteCapture.accountName },
        metrics: note.metrics || {},
        metricsSummary: note.metricSummary,
        sourceKeyword: elements.inspirationKeyword.value.trim(),
        contentDirection: elements.inspirationDirection.value.trim(),
      });
      websiteSaved = true;
      savedInspirationUrl = `/inspirations/${data.record.id}`;
      elements.openInspiration.hidden = false;
    } catch (error) {
      websiteError = error;
    }
  }
  try {
    const targets = [websiteSaved ? "网站爆款库（已生成 AI 拆解）" : "", localSaved ? "本地知识库（Markdown + JSON）" : ""]
      .filter(Boolean).join(" + ");
    if (!targets) throw websiteError || localError || new Error("没有完成任何保存操作");
    const warning = [
      websiteError ? `网站保存失败：${errorMessage(websiteError)}` : "",
      localError ? `本地保存失败：${errorMessage(localError)}` : "",
    ].filter(Boolean).join("\n");
    showStatus(`保存成功：${targets}`, "success");
    if (warning) showStatus(`部分保存成功：${targets}\n${warning}`, "error");
  } catch (error) {
    showStatus(`操作失败：${errorMessage(error)}`, "error");
  } finally {
    setBusy(elements.saveInspiration, false, "保存笔记");
  }
}

function editedInspirationCapture() {
  const { capture, note } = capturedInspiration;
  const title = elements.inspirationTitle.value.trim();
  const description = elements.inspirationContent.value.trim();
  if (!title) throw new Error("标题不能为空");
  if (!description) throw new Error("正文不能为空；如果页面没有自动识别，可以先粘贴补充");
  const editedNote = {
    ...note,
    title,
    description,
    tags: elements.inspirationTags.value.split(/[，,]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean),
  };
  return { ...capture, sourceUrl: editedNote.url || capture.sourceUrl, contents: [editedNote] };
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
    capturedAccount = editedCapture();
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

function editedCapture() {
  return {
    ...capturedAccount,
    accountName: elements.accountName.value.trim(),
    bio: elements.bio.value.trim(),
    followerCount: elements.followerCount.value.trim(),
  };
}

async function refreshArchiveStatus() {
  try {
    const status = await getLocalArchiveStatus();
    renderArchiveStatus(status);
    return status;
  } catch (error) {
    elements.localArchiveStatus.textContent = `本地资料库状态读取失败：${error.message}`;
  }
}

function renderArchiveStatus(status) {
  if (!status.supported) {
    elements.localArchiveStatus.textContent = "当前浏览器不支持文件夹直写，请使用最新版桌面版 Chrome。";
    elements.chooseLocalArchive.disabled = true;
    return;
  }
  if (!status.configured) {
    elements.localArchiveStatus.textContent = "尚未选择。可选择 Obsidian 仓库、Git 仓库或任意知识库文件夹。";
    elements.chooseLocalArchive.textContent = "选择本地资料库文件夹";
    return;
  }
  const permissionText = status.permission === "granted" ? "可直接写入" : "保存时需重新授权";
  elements.localArchiveStatus.textContent = `${status.name} · ${permissionText}`;
  elements.chooseLocalArchive.textContent = "更换本地资料库文件夹";
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
  elements.inspirationTags.value = (note.tags || []).join("，");
  elements.inspirationKeyword.value = "";
  elements.inspirationDirection.value = "";
  elements.inspirationSource.textContent = [
    `${capture.platform} · ${note.type === "video" ? "视频" : "图文"}`,
    note.author?.name ? `作者：${note.author.name}` : "作者未识别",
    note.publishedAt ? `发布：${formatDate(note.publishedAt)}` : "发布时间未公开",
    `原文：${note.url || capture.sourceUrl}`,
  ].join("\n");
  elements.inspirationMetrics.replaceChildren(...contentMetricRows(note.metrics));
  elements.inspirationImages.replaceChildren(...(note.imageUrls || []).map((url, index) => {
    const image = document.createElement("img");
    image.src = url;
    image.alt = `笔记图片 ${index + 1}`;
    image.loading = "lazy";
    return image;
  }));
  elements.inspirationMedia.textContent = note.imageUrls?.length
    ? `已识别 ${note.imageUrls.length} 张图片，原图链接会写入本地档案和网站爆款库。`
    : "当前页面未识别到图片。";
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
  showStatus(`操作失败：${errorMessage(error)}`, "error");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function pageTypeLabel(type) {
  return { account: "账号主页", creator_backend: "创作者后台", content: "内容页", unknown: "未知页面" }[type] || "未知页面";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
