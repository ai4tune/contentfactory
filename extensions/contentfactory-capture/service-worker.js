const CONTENT_FACTORY_PAGES = [
  "http://localhost/*",
  "http://127.0.0.1/*",
];

async function connectOpenContentFactoryPages() {
  const tabs = await chrome.tabs.query({ url: CONTENT_FACTORY_PAGES });
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["bridge.js"] });
    } catch {
      // A tab can close or navigate while the extension is being reloaded.
    }
  }));
}

function reconnectOpenPages() {
  void connectOpenContentFactoryPages().catch(() => {});
}

reconnectOpenPages();

chrome.runtime.onInstalled.addListener(() => {
  reconnectOpenPages();
});

chrome.runtime.onStartup.addListener(() => {
  reconnectOpenPages();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "contentfactory-open-capture-popup") return false;

  (async () => {
    try {
      await chrome.action.openPopup();
      sendResponse({ opened: true });
    } catch (error) {
      sendResponse({
        opened: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
});
