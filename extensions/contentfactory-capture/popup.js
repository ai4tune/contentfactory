const captureButton = document.getElementById("capture");
const statusBox = document.getElementById("status");
const sourceKeywordInput = document.getElementById("sourceKeyword");
const accountPositionInput = document.getElementById("accountPosition");

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  statusBox.textContent = "正在采集当前页面...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("没有找到当前标签页");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureVisiblePage,
    });
    const payload = {
      ...result,
      sourceKeyword: sourceKeywordInput.value.trim(),
      accountPosition: accountPositionInput.value.trim(),
    };

    statusBox.textContent = "已采集页面，正在发送到内容工厂并拆解...";

    const response = await fetch("http://localhost:3000/api/capture/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "导入失败");
    }

    statusBox.textContent = `导入成功\n标题：${payload.title}\n记录：${data.record.id}`;
  } catch (error) {
    statusBox.textContent = `导入失败：${error.message}`;
  } finally {
    captureButton.disabled = false;
  }
});

function captureVisiblePage() {
  const title =
    readMeta("og:title") ||
    readMeta("twitter:title") ||
    document.querySelector("h1")?.innerText?.trim() ||
    document.title;
  const description = readMeta("description") || readMeta("og:description") || "";
  const platform = inferPlatform(location.hostname);
  const content = extractMainText();
  const metrics = extractMetrics(document.body.innerText);

  return {
    platform,
    sourceUrl: location.href,
    title: cleanText(title),
    metrics,
    content: [description, content].filter(Boolean).join("\n\n").slice(0, 12000),
  };

  function readMeta(name) {
    return (
      document.querySelector(`meta[property="${name}"]`)?.content ||
      document.querySelector(`meta[name="${name}"]`)?.content ||
      ""
    ).trim();
  }

  function extractMainText() {
    const root =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.body;
    const textBlocks = [...root.querySelectorAll("h1,h2,h3,p,span,div")]
      .map((node) => cleanText(node.innerText || ""))
      .filter((text) => text.length >= 8 && text.length <= 500)
      .filter(unique());

    return textBlocks.slice(0, 80).join("\n");
  }

  function cleanText(value) {
    return String(value).replace(/\s+/g, " ").trim();
  }

  function unique() {
    const seen = new Set();

    return (value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    };
  }

  function extractMetrics(text) {
    const matches = text.match(/(点赞|赞|收藏|评论|阅读|转发|分享)[\s:：]*[\d,.万wWkK]+/g) || [];

    return [...new Set(matches)].slice(0, 12).join("，");
  }

  function inferPlatform(hostname) {
    if (hostname.includes("xiaohongshu")) {
      return "小红书";
    }

    if (hostname.includes("weixin.qq.com")) {
      return "公众号";
    }

    if (hostname.includes("douyin")) {
      return "抖音";
    }

    if (hostname.includes("bilibili")) {
      return "B站";
    }

    return hostname;
  }
}
