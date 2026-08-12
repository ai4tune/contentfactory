(() => {
  const buttonId = "contentfactory-xhs-capture-button";
  if (document.getElementById(buttonId)) return;

  const button = document.createElement("button");
  button.id = buttonId;
  button.type = "button";
  button.style.cssText = [
    "position:fixed",
    "right:24px",
    "bottom:88px",
    "z-index:2147483647",
    "height:44px",
    "padding:0 18px",
    "border:0",
    "border-radius:999px",
    "background:#173e32",
    "color:#fff",
    "font:600 14px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "box-shadow:0 10px 30px rgba(23,62,50,.28)",
    "cursor:pointer",
  ].join(";");

  function isAccountPage() {
    return location.pathname.toLowerCase().includes("/user/profile/");
  }

  function isNotePage() {
    const path = location.pathname.toLowerCase();
    return path.includes("/explore/") || path.includes("/discovery/item/");
  }

  function isSearchPage() {
    return location.pathname.toLowerCase().includes("/search_result");
  }

  function renderDefaultLabel() {
    button.textContent = isAccountPage()
      ? "采集当前账号"
      : isNotePage() ? "预览并保存笔记"
        : isSearchPage() ? "采集当前搜索结果" : "打开采集助手";
  }

  button.addEventListener("click", async () => {
    if (!isAccountPage() && !isNotePage() && !isSearchPage()) {
      button.textContent = "请打开账号主页或笔记详情";
      window.setTimeout(renderDefaultLabel, 2_000);
      return;
    }

    button.disabled = true;
    button.textContent = "正在打开采集助手…";
    try {
      const response = await chrome.runtime.sendMessage({ type: "contentfactory-open-capture-popup" });
      if (!response?.opened) throw new Error(response?.error || "未能打开插件");
    } catch {
      button.textContent = "请点击工具栏中的采集插件";
      window.setTimeout(renderDefaultLabel, 3_000);
    } finally {
      button.disabled = false;
    }
  });

  document.body.append(button);
  renderDefaultLabel();

  let lastPath = location.pathname;
  window.setInterval(() => {
    if (lastPath === location.pathname) return;
    lastPath = location.pathname;
    renderDefaultLabel();
  }, 1_000);
})();
