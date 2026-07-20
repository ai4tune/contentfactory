import type { LocalKnowledgeItem } from "./types";

const DATABASE_NAME = "contentfactory-knowledge";
const DATABASE_VERSION = 1;
const HANDLE_STORE = "handles";
const INDEX_STORE = "local-index";
const ROOT_HANDLE_KEY = "root-directory";
const MAX_SEARCH_CHARACTERS = 12_000;
const SUPPORTED_EXTENSIONS = new Set(["md", "txt"]);

type LocalIndexRecord = LocalKnowledgeItem & {
  handle: FileSystemFileHandle;
};

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[
    string,
    FileSystemFileHandle | IterableDirectoryHandle,
  ]>;
};

type ReadableDirectoryHandle = IterableDirectoryHandle & {
  queryPermission: (options?: { mode?: "read" }) => Promise<PermissionState>;
  requestPermission: (options?: { mode?: "read" }) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" }) => Promise<ReadableDirectoryHandle>;
};

export function supportsDirectoryPicker() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseKnowledgeDirectory() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;

  if (!picker) {
    throw new Error("当前浏览器不支持文件夹读取，请使用桌面版 Chrome 或 Edge。");
  }

  const handle = await picker({ mode: "read" });
  await writeRecord(HANDLE_STORE, handle, ROOT_HANDLE_KEY);
  return refreshLocalIndex(handle);
}

export async function loadLocalKnowledge() {
  return readAllRecords<LocalIndexRecord>(INDEX_STORE).then(stripHandles);
}

export async function reconnectKnowledgeDirectory() {
  const handle = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);

  if (!handle) {
    return null;
  }

  const permission = await handle.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    return { permission, items: await loadLocalKnowledge() };
  }

  return { permission, items: await refreshLocalIndex(handle) };
}

export async function requestStoredDirectoryPermission() {
  const handle = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);

  if (!handle) {
    throw new Error("没有已保存的文件夹，请重新选择。");
  }

  const permission = await handle.requestPermission({ mode: "read" });
  if (permission !== "granted") {
    throw new Error("未获得文件夹读取权限。");
  }

  return refreshLocalIndex(handle);
}

export async function refreshStoredDirectory() {
  const handle = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);

  if (!handle) {
    throw new Error("没有已连接的文件夹，请先选择知识库文件夹。");
  }

  const permission = await handle.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    throw new Error("文件夹授权已失效，请重新授权后刷新。");
  }

  return refreshLocalIndex(handle);
}

export async function readLocalKnowledgeItem(id: string) {
  const record = await readRecord<LocalIndexRecord>(INDEX_STORE, id);
  const root = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);

  if (!record || !root) {
    throw new Error("没有找到这份本地资料，请刷新知识库后重试。");
  }

  const permission = await root.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    const requested = await root.requestPermission({ mode: "read" });
    if (requested !== "granted") {
      throw new Error("未获得该文件的读取权限。");
    }
  }

  return record.handle.getFile().then((file) => file.text());
}

export async function disconnectKnowledgeDirectory() {
  const database = await openDatabase();
  const transaction = database.transaction([HANDLE_STORE, INDEX_STORE], "readwrite");
  transaction.objectStore(HANDLE_STORE).clear();
  transaction.objectStore(INDEX_STORE).clear();
  await transactionDone(transaction);
  database.close();
}

export function searchLocalKnowledge(items: LocalKnowledgeItem[], query: string) {
  const terms = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) {
    return items;
  }

  return items
    .map((item) => {
      const title = item.title.toLocaleLowerCase();
      const path = item.path.toLocaleLowerCase();
      const tags = item.tags.join(" ").toLocaleLowerCase();
      const body = item.searchText.toLocaleLowerCase();
      const matches = terms.filter((term) =>
        title.includes(term) || path.includes(term) || tags.includes(term) || body.includes(term),
      );
      const score = matches.reduce(
        (total, term) => total + (title.includes(term) ? 4 : 0) + (tags.includes(term) ? 2 : 0) + (body.includes(term) ? 1 : 0),
        0,
      );
      return { item, matches: matches.length, score };
    })
    .filter((result) => result.matches === terms.length)
    .sort((left, right) => right.score - left.score || right.item.lastModified - left.item.lastModified)
    .map((result) => result.item);
}

async function refreshLocalIndex(root: IterableDirectoryHandle) {
  const records = await collectFiles(root);
  const database = await openDatabase();
  const transaction = database.transaction(INDEX_STORE, "readwrite");
  const store = transaction.objectStore(INDEX_STORE);
  store.clear();
  records.forEach((record) => store.put(record));
  await transactionDone(transaction);
  database.close();
  return stripHandles(records);
}

async function collectFiles(root: IterableDirectoryHandle) {
  const records: LocalIndexRecord[] = [];

  async function visit(directory: IterableDirectoryHandle, parentPath: string) {
    for await (const [name, handle] of directory.entries()) {
      const path = parentPath ? `${parentPath}/${name}` : name;

      if (handle.kind === "directory") {
        await visit(handle, path);
        continue;
      }

      const extension = name.split(".").pop()?.toLocaleLowerCase();
      if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
        continue;
      }

      const file = await handle.getFile();
      const text = await file.text();
      const frontMatter = readFrontMatter(text);
      const title = frontMatter.title ?? readMarkdownTitle(text) ?? name.replace(/\.(md|txt)$/i, "");
      const normalized = text.replace(/\s+/g, " ").trim();

      records.push({
        id: `local:${path}`,
        title,
        path,
        extension: extension as "md" | "txt",
        size: file.size,
        lastModified: file.lastModified,
        tags: frontMatter.tags,
        excerpt: normalized.slice(0, 220),
        searchText: normalized.slice(0, MAX_SEARCH_CHARACTERS),
        indexedAt: new Date().toISOString(),
        handle,
      });
    }
  }

  await visit(root, "");
  return records.sort((left, right) => right.lastModified - left.lastModified);
}

function readFrontMatter(text: string) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return { title: undefined, tags: [] as string[] };
  }

  const title = match[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  const inlineTags = match[1].match(/^tags:\s*\[(.*?)\]\s*$/m)?.[1];
  const scalarTags = match[1].match(/^tags:\s*([^\n]+)$/m)?.[1];
  const listTags = [...match[1].matchAll(/^\s*-\s+(.+)$/gm)].map((item) => item[1]);
  const tags = (inlineTags?.split(",") ?? scalarTags?.split(/[ ,]+/) ?? listTags)
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

  return { title: title?.trim(), tags };
}

function readMarkdownTitle(text: string) {
  return text.match(/^#\s+(.+)$/m)?.[1].trim();
}

function stripHandles(records: LocalIndexRecord[]) {
  return records.map((record) => {
    const { handle, ...item } = record;
    void handle;
    return item;
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE);
      }
      if (!database.objectStoreNames.contains(INDEX_STORE)) {
        database.createObjectStore(INDEX_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地知识索引。"));
  });
}

async function writeRecord(storeName: string, value: unknown, key: IDBValidKey) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value, key);
  await transactionDone(transaction);
  database.close();
}

async function readRecord<T>(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).get(key);
  const result = await requestResult<T | undefined>(request);
  database.close();
  return result;
}

async function readAllRecords<T>(storeName: string) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).getAll();
  const result = await requestResult<T[]>(request);
  database.close();
  return result;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本地知识索引读取失败。"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("本地知识索引保存失败。"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本地知识索引保存已中止。"));
  });
}
