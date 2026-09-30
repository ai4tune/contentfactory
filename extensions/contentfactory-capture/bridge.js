(() => {
  const SOURCE = "contentfactory-capture-extension";
  const version = chrome.runtime.getManifest().version;
  const bridgeMarker = "__contentFactoryCaptureBridgeVersion";

  async function announceReady() {
    const settings = await chrome.storage.local.get({ baseUrl: "", accessToken: "" });
    window.postMessage({
      source: SOURCE,
      type: "ready",
      version,
      authorized: Boolean(settings.accessToken) && normalizedOrigin(settings.baseUrl) === window.location.origin,
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
      chrome.storage.local.set({ baseUrl, accessToken: token })
        .then(() => announceAuthorization(requestId, true))
        .catch(() => announceAuthorization(requestId, false));
    }
  });

  window.addEventListener("focus", () => void announceReady());

  function announceAuthorization(requestId, authorized) {
    window.postMessage({
      source: SOURCE,
      type: "authorization-complete",
      requestId,
      authorized,
      version,
    }, window.location.origin);
  }

  function normalizedOrigin(value) {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  }
})();
