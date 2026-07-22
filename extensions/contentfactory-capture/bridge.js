(() => {
  const SOURCE = "contentfactory-capture-extension";
  const version = chrome.runtime.getManifest().version;
  const bridgeMarker = "contentFactoryCaptureBridgeVersion";

  function announceReady() {
    document.documentElement.dataset.contentFactoryCaptureVersion = version;
    window.postMessage({ source: SOURCE, type: "ready", version }, window.location.origin);
  }

  announceReady();
  if (document.documentElement.dataset[bridgeMarker] === version) return;
  document.documentElement.dataset[bridgeMarker] = version;

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
