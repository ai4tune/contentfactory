(() => {
  const SOURCE = "contentfactory-capture-extension";
  const version = chrome.runtime.getManifest().version;
  const bridgeMarker = "__contentFactoryCaptureBridgeVersion";

  function announceReady() {
    window.postMessage({ source: SOURCE, type: "ready", version }, window.location.origin);
  }

  announceReady();
  if (globalThis[bridgeMarker] === version) return;
  globalThis[bridgeMarker] = version;

  window.addEventListener("message", (event) => {
    if (
      event.source === window
      && event.data?.source === "contentfactory-positioning-page"
      && event.data?.type === "probe"
    ) {
      announceReady();
    }
  });

  window.addEventListener("focus", announceReady);
})();
