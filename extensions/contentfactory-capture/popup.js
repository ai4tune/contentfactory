const DEFAULT_BASE_URL = "http://localhost:3000";

const elements = {
  accessToken: document.getElementById("accessToken"),
  accountName: document.getElementById("accountName"),
  analyze: document.getElementById("analyze"),
  baseUrl: document.getElementById("baseUrl"),
  bio: document.getElementById("bio"),
  capture: document.getElementById("capture"),
  captureMeta: document.getElementById("captureMeta"),
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
  saveSettings: document.getElementById("saveSettings"),
  status: document.getElementById("status"),
};

let capturedAccount = null;
let positioningDraft = null;

initialize();

elements.saveSettings.addEventListener("click", saveSettings);
elements.capture.addEventListener("click", captureCurrentPage);
elements.analyze.addEventListener("click", analyzeCapture);
elements.confirm.addEventListener("click", confirmPositioning);

async function initialize() {
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL, accessToken: "" });
  elements.baseUrl.value = settings.baseUrl;
  elements.accessToken.value = settings.accessToken;
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
  showStatus("正在采集当前页面可见的账号信息…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("没有找到当前标签页");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureVisibleAccountPage,
    });
    if (!result?.accountName) throw new Error("未识别到账号名称，请确认当前打开的是账号页");
    capturedAccount = result;
    positioningDraft = null;
    renderCapture(result);
    elements.draftPreview.hidden = true;
    showStatus("已采集。请先检查可见信息，确认后再进行 AI 定位。", "success");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(elements.capture, false, "采集当前账号页");
  }
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
  const settings = await chrome.storage.local.get({ baseUrl: DEFAULT_BASE_URL, accessToken: "" });
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const headers = { "Content-Type": "application/json" };
  if (settings.accessToken) headers.Authorization = `Bearer ${settings.accessToken}`;
  const response = await fetch(`${baseUrl}/api/capture/account`, {
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
  elements.captureMeta.textContent = `${capture.platform} · ${pageTypeLabel(capture.pageType)}\n${capture.sourceUrl}\n互动摘要：${capture.interactionSummary || "未识别"}`;
  elements.contentList.replaceChildren(...capture.contents.slice(0, 12).map((item) => {
    const row = document.createElement("li");
    row.textContent = `${item.title}${item.metrics ? ` · ${item.metrics}` : ""}`;
    return row;
  }));
  if (!capture.contents.length) {
    const row = document.createElement("li");
    row.textContent = "当前页面未识别到内容列表，仍可基于账号简介分析。";
    elements.contentList.append(row);
  }
  elements.capturePreview.hidden = false;
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

function captureVisibleAccountPage() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visibleText = (node) => clean(node?.innerText || node?.textContent || "");
  const firstText = (selectors) => {
    for (const selector of selectors) {
      const value = visibleText(document.querySelector(selector));
      if (value) return value;
    }
    return "";
  };
  const meta = (name) => clean(document.querySelector(`meta[property="${name}"]`)?.content || document.querySelector(`meta[name="${name}"]`)?.content);
  const hostname = location.hostname.toLowerCase();
  const platform = hostname.includes("xiaohongshu") ? "小红书"
    : hostname.includes("weixin.qq.com") ? "公众号"
      : hostname.includes("douyin") ? "抖音"
        : hostname.includes("weibo") ? "微博"
          : hostname.includes("bilibili") ? "B站" : hostname;
  const accountSelectors = hostname.includes("xiaohongshu")
    ? [".user-name", ".username", "[class*='user-name']", "[class*='userName']", "h1"]
    : hostname.includes("weixin.qq.com")
      ? ["#js_name", ".profile_nickname", ".account_nickname", "h1"]
      : ["[class*='nickname']", "[class*='user-name']", "[class*='username']", "h1"];
  const bioSelectors = hostname.includes("xiaohongshu")
    ? [".user-desc", ".user-bio", "[class*='user-desc']", "[class*='userDesc']"]
    : ["[class*='signature']", "[class*='description']", "[class*='profile-desc']"];
  const accountName = clean(
    hostname.includes("weixin.qq.com") ? meta("og:article:author") : "",
  ) || firstText(accountSelectors) || meta("og:site_name") || clean(document.title).split(/[|–-]/)[0];
  const bio = firstText(bioSelectors) || meta("description") || meta("og:description");
  const bodyText = visibleText(document.body).slice(0, 100_000);
  const followerPatterns = [
    /(?:粉丝|关注者)[\s:：]*([\d,.]+\s*(?:万|w|W|k|K)?)/,
    /([\d,.]+\s*(?:万|w|W|k|K)?)\s*(?:粉丝|关注者)/,
  ];
  const followerMatch = followerPatterns.map((pattern) => bodyText.match(pattern)).find(Boolean);
  const followerCount = followerMatch ? clean(followerMatch[0]) : "";
  const metricMatches = bodyText.match(/(?:获赞与收藏|获赞|点赞|收藏|评论|阅读|转发|分享|播放)[\s:：]*[\d,.]+\s*(?:万|w|W|k|K)?/g) || [];
  const interactionSummary = [...new Set(metricMatches.map(clean))].slice(0, 16).join("，");
  const contentSelectors = hostname.includes("xiaohongshu")
    ? ["a[href*='/explore/']", "a[href*='/discovery/item/']"]
    : hostname.includes("weixin.qq.com")
      ? ["a[href*='mp.weixin.qq.com/s']", "article a[href]"]
      : ["article a[href]", "main a[href]", "[class*='content'] a[href]", "[class*='note'] a[href]"];
  const links = [...document.querySelectorAll(contentSelectors.join(","))];
  const seen = new Set();
  const contents = [];
  for (const link of links) {
    const container = link.closest("article,li,[class*='card'],[class*='item'],[class*='note']") || link;
    const rawTitle = clean(link.getAttribute("title")) || visibleText(link.querySelector("h1,h2,h3,[class*='title']")) || visibleText(link);
    const title = rawTitle.split("\n").map(clean).find((line) => line.length >= 4 && line.length <= 180 && !/^(\d|\u70b9\u8d5e|\u6536\u85cf|\u8bc4\u8bba)/.test(line));
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const cardText = visibleText(container);
    const metrics = (cardText.match(/(?:点赞|赞|收藏|评论|阅读|播放)?[\s:：]*[\d,.]+\s*(?:万|w|W|k|K)?/g) || []).map(clean).filter(Boolean).slice(0, 4).join("，");
    contents.push({ title, url: new URL(link.href, location.href).href, metrics });
    if (contents.length >= 20) break;
  }
  if (!contents.length && (meta("og:title") || document.querySelector("h1"))) {
    const title = meta("og:title") || firstText(["h1"]);
    if (title) contents.push({ title, url: location.href, metrics: interactionSummary });
  }
  const path = location.pathname.toLowerCase();
  const pageType = /creator|dashboard|platform|admin/.test(path) ? "creator_backend"
    : contents.length > 1 || /user|profile|account/.test(path) ? "account"
      : /article|explore|discovery|video|note/.test(path) ? "content" : "unknown";

  return {
    platform,
    pageType,
    sourceUrl: location.href,
    accountName: accountName.slice(0, 160),
    bio: bio.slice(0, 2_000),
    followerCount: followerCount.slice(0, 100),
    contents,
    interactionSummary: interactionSummary.slice(0, 2_000),
    capturedAt: new Date().toISOString(),
  };
}
