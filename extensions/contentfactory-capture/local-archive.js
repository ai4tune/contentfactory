import { buildLocalArchive } from "./local-archive-format.mjs";

const DATABASE_NAME = "contentfactory-capture";
const STORE_NAME = "directory-handles";
const HANDLE_KEY = "local-archive-root";

export function supportsLocalArchive() {
  return typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
}

export async function chooseLocalArchiveDirectory() {
  if (!supportsLocalArchive()) throw new Error("当前浏览器不支持直接写入本地文件夹，请使用最新版桌面版 Chrome");
  const handle = await window.showDirectoryPicker({ id: HANDLE_KEY, mode: "readwrite" });
  await storeHandle(handle);
  return archiveStatus(handle);
}

export async function getLocalArchiveStatus() {
  if (!supportsLocalArchive()) return { supported: false, configured: false, permission: "unsupported" };
  const handle = await readHandle();
  if (!handle) return { supported: true, configured: false, permission: "prompt" };
  return archiveStatus(handle);
}

export async function saveCaptureLocally(capture) {
  const handle = await requireWritableHandle();
  const archive = buildLocalArchive(capture);
  let directory = handle;
  for (const segment of archive.directorySegments) {
    directory = await directory.getDirectoryHandle(segment, { create: true });
  }
  await Promise.all([
    writeTextFile(directory, `${archive.baseName}.md`, archive.markdown),
    writeTextFile(directory, `${archive.baseName}.json`, archive.json),
  ]);
  await ensureReadme(handle);
  return {
    ...archive,
    rootName: handle.name,
    relativePath: [...archive.directorySegments, archive.baseName].join("/"),
  };
}

async function requireWritableHandle() {
  if (!supportsLocalArchive()) throw new Error("当前浏览器不支持直接写入本地文件夹");
  const handle = await readHandle();
  if (!handle) throw new Error("请先选择本地资料库文件夹");
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("没有本地资料库的写入权限，请重新选择文件夹");
  return handle;
}

async function archiveStatus(handle) {
  let permission = "prompt";
  try {
    permission = await handle.queryPermission({ mode: "readwrite" });
  } catch {
    permission = "prompt";
  }
  return { supported: true, configured: true, permission, name: handle.name };
}

async function ensureReadme(root) {
  const directory = await root.getDirectoryHandle("内容工厂采集", { create: true });
  try {
    await directory.getFileHandle("README.md");
  } catch {
    await writeTextFile(directory, "README.md", [
      "# 内容工厂本地采集库",
      "",
      "- `账号/`：账号定位所需的公开账号信息和可见作品列表。",
      "- `爆款/YYYY-MM/`：采集的文章或笔记正文、指标、标签和图片链接。",
      "- 每条内容同时保存 Markdown 与 JSON；Markdown 便于阅读，JSON 便于 Codex、WorkBuddy 和其他工具处理。",
      "- 图片默认保留原始链接，不自动下载本地文件。",
      "",
    ].join("\n"));
  }
}

async function writeTextFile(directory, name, content) {
  const fileHandle = await directory.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readHandle() {
  return withStore("readonly", (store) => requestResult(store.get(HANDLE_KEY)));
}

async function storeHandle(handle) {
  return withStore("readwrite", (store) => requestResult(store.put(handle, HANDLE_KEY)));
}

function withStore(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error || new Error("无法打开本地资料库配置"));
    request.onsuccess = async () => {
      const database = request.result;
      const transaction = database.transaction(STORE_NAME, mode);
      try {
        const result = await operation(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => reject(transaction.error || new Error("无法保存本地资料库配置"));
      } catch (error) {
        database.close();
        reject(error);
      }
    };
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
