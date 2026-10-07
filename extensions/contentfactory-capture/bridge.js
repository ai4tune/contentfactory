(() => {
  const SOURCE = "contentfactory-capture-extension";
  const version = chrome.runtime.getManifest().version;
  const bridgeMarker = "__contentFactoryCaptureBridgeVersion";
  let validation = null;

  async function announceReady(force = false) {
    const settings = await chrome.storage.local.get({ baseUrl: "", accessToken: "" });
    const result = normalizedOrigin(settings.baseUrl) === window.location.origin && settings.accessToken
      ? await validateToken(settings.accessToken, force) : { authorized: false };
    const current = await chrome.storage.local.get({ baseUrl: "", accessToken: "" });
    if (current.baseUrl !== settings.baseUrl || current.accessToken !== settings.accessToken) return;
    window.postMessage({
      source: SOURCE,
      type: "ready",
      version,
      authorized: result.authorized,
      authorizationChecked: true,
      authorizationError: result.error,
    }, window.location.origin);
  }

  void announceReady();
  if (globalThis[bridgeMarker] === version) return;
  globalThis[bridgeMarker] = version;

  window.addEventListener("message", (event) => {
    if (
      event.source === window
      && event.data?.source === "contentfactory-positioning-page"
      && event.data?.type === "probe"
    ) {
      void announceReady();
      return;
    }

    if (
      event.source === window
      && event.data?.source === "contentfactory-positioning-page"
      && event.data?.type === "authorize"
    ) {
      const requestId = String(event.data.requestId || "");
      const token = typeof event.data.token === "string" ? event.data.token.trim() : "";
      const baseUrl = normalizedOrigin(event.data.baseUrl);
      if (!requestId || !token || baseUrl !== window.location.origin) {
        announceAuthorization(requestId, false);
        return;
      }
      void (async () => {
        const result = await validateToken(token, true);
        if (!result.authorized) return announceAuthorization(requestId, false, result.error);
        await chrome.storage.local.set({ baseUrl, accessToken: token });
        announceAuthorization(requestId, true);
      })().catch(() => announceAuthorization(requestId, false, "插件无法保存授权，请重新加载插件。"));
    }
  });

  window.addEventListener("focus", () => void announceReady(true));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.baseUrl || changes.accessToken)) void announceReady(true);
  });

  function announceAuthorization(requestId, authorized, error) {
    window.postMessage({
      source: SOURCE,
      type: "authorization-complete",
      requestId,
      authorized,
      authorizationChecked: true,
      authorizationError: error,
      version,
    }, window.location.origin);
  }

  function validateToken(token, force = false) {
    if (!force && validation?.token === token && Date.now() - validation.time < 5000) return validation.result;
    const result = fetch(`${window.location.origin}/api/capture/status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(8000),
    }).then(async (response) => {
      const data = await response.json();
      return { authorized: response.ok && data.authorized === true, error: data.error };
    }).catch(() => ({ authorized: false, error: "暂时无法核验采集授权，请重新检测插件。" }));
    validation = { token, time: Date.now(), result };
    return result;
  }

  function normalizedOrigin(value) {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  }
})();
