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

  function renderDefaultLabel() {
    button.textContent = isAccountPage() ? "采集当前账号" : "先去「我」再采集";
  }

  button.addEventListener("click", async () => {
    if (!isAccountPage()) {
      button.textContent = "请先点击左侧「我」";
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
