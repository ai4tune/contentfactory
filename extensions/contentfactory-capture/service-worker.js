const BRIDGE_SCRIPT_ID = "contentfactory-dynamic-bridge";

function originPattern(baseUrl) {
  try {
    return `${new URL(baseUrl).origin}/*`;
  } catch {
    return "http://localhost/*";
  }
}

async function registerContentFactoryBridge(baseUrl) {
  const matches = [originPattern(baseUrl)];
  await chrome.scripting.unregisterContentScripts({ ids: [BRIDGE_SCRIPT_ID] }).catch(() => {});
  await chrome.scripting.registerContentScripts([{
    id: BRIDGE_SCRIPT_ID,
    matches,
    js: ["bridge.js"],
    runAt: "document_start",
    persistAcrossSessions: true,
  }]);
  return matches;
}

async function connectOpenContentFactoryPages(baseUrl) {
  const settings = baseUrl ? { baseUrl } : await chrome.storage.local.get({ baseUrl: "http://localhost:3000" });
  const pages = [originPattern(settings.baseUrl)];
  const tabs = await chrome.tabs.query({ url: pages });
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
  void (async () => {
    const settings = await chrome.storage.local.get({ baseUrl: "http://localhost:3000" });
    await registerContentFactoryBridge(settings.baseUrl);
    await connectOpenContentFactoryPages(settings.baseUrl);
  })().catch(() => {});
}

reconnectOpenPages();

chrome.runtime.onInstalled.addListener(() => {
  reconnectOpenPages();
});

chrome.runtime.onStartup.addListener(() => {
  reconnectOpenPages();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "contentfactory-register-origin") {
    registerContentFactoryBridge(message.baseUrl)
      .then(() => connectOpenContentFactoryPages(message.baseUrl))
      .then(() => sendResponse({ registered: true }))
      .catch((error) => sendResponse({ registered: false, error: String(error) }));
    return true;
  }
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
