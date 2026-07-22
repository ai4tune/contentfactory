const SOURCE = "contentfactory-capture-extension";

function announceReady() {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.dataset.contentFactoryCaptureVersion = version;
  window.postMessage({ source: SOURCE, type: "ready", version }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (
    event.source === window
    && event.data?.source === "contentfactory-positioning-page"
    && event.data?.type === "probe"
  ) {
    announceReady();
  }
});

announceReady();
