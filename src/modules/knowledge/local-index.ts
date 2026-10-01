import type { KnowledgeScanReport, LocalKnowledgeExtension, LocalKnowledgeItem } from "./types";
import type { KnowledgeOrganizationPlan } from "./organization";
import { extractLocalDocumentText } from "./document-text";
import {
  classifyKnowledgeFile,
  knowledgeFileExtension,
  shouldIgnoreKnowledgeDirectory,
} from "./file-classification";

const DATABASE_NAME = "contentfactory-knowledge";
const DATABASE_VERSION = 2;
const HANDLE_STORE = "handles";
const INDEX_STORE = "local-index";
const META_STORE = "meta";
const ROOT_HANDLE_KEY = "root-directory";
const SCAN_REPORT_KEY = "scan-report";
const MAX_INDEX_BYTES = 128_000;
const MAX_SEARCH_CHARACTERS = 12_000;
const ORGANIZED_ROOT_NAME = "内容工厂-已整理";

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
  queryPermission: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
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

export async function loadKnowledgeScanReport() {
  return readRecord<KnowledgeScanReport>(META_STORE, SCAN_REPORT_KEY);
}

export async function reconnectKnowledgeDirectory() {
  const handle = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);

  if (!handle) {
    return null;
  }

  const permission = await handle.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    return {
      permission,
      items: await loadLocalKnowledge(),
      report: await loadKnowledgeScanReport(),
    };
  }

  const snapshot = await refreshLocalIndex(handle);
  return { permission, ...snapshot };
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

  const file = await record.handle.getFile();
  return extractLocalDocumentText(file, record.extension);
}

export async function applyKnowledgeOrganization(plan: KnowledgeOrganizationPlan) {
  const root = await readRecord<ReadableDirectoryHandle>(HANDLE_STORE, ROOT_HANDLE_KEY);
  if (!root) throw new Error("没有已连接的本地文件夹，请先重新选择。");
  const permission = await root.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("未获得创建整理副本的写入权限。");

  const folderById = new Map(plan.folders.map((folder) => [folder.id, folder]));
  const destinationRoot = await root.getDirectoryHandle(ORGANIZED_ROOT_NAME, { create: true });
  let copiedFiles = 0;
  for (const assignment of plan.assignments) {
    const record = await readRecord<LocalIndexRecord>(INDEX_STORE, assignment.sourceId);
    const folder = folderById.get(assignment.folderId);
    if (!record || !folder) continue;
    const destination = await destinationRoot.getDirectoryHandle(folder.name, { create: true });
    const sourceFile = await record.handle.getFile();
    const destinationFile = await destination.getFileHandle(safeCopyName(record.path), { create: true });
    const writable = await destinationFile.createWritable();
    await writable.write(await sourceFile.arrayBuffer());
    await writable.close();
    copiedFiles += 1;
  }
  await writeTextFile(destinationRoot, "README.md", [
    "# 内容工厂整理副本",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "这是系统根据用户确认的方案创建的非破坏式副本。原文件没有移动或删除。",
    "",
    ...plan.folders.map((folder) => `- ${folder.name}：${folder.purpose}`),
    "",
  ].join("\n"));
  return { copiedFiles, rootName: ORGANIZED_ROOT_NAME };
}

export async function disconnectKnowledgeDirectory() {
  const database = await openDatabase();
  const transaction = database.transaction([HANDLE_STORE, INDEX_STORE, META_STORE], "readwrite");
  transaction.objectStore(HANDLE_STORE).clear();
  transaction.objectStore(INDEX_STORE).clear();
  transaction.objectStore(META_STORE).clear();
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
  const { records, report } = await collectFiles(root);
  const database = await openDatabase();
  const transaction = database.transaction([INDEX_STORE, META_STORE], "readwrite");
  const store = transaction.objectStore(INDEX_STORE);
  store.clear();
  records.forEach((record) => store.put(record));
  transaction.objectStore(META_STORE).put(report, SCAN_REPORT_KEY);
  await transactionDone(transaction);
  database.close();
  return { items: stripHandles(records), report };
}

async function collectFiles(root: IterableDirectoryHandle) {
  const records: LocalIndexRecord[] = [];
  let totalFiles = 0;
  let emptyFiles = 0;
  let textFiles = 0;
  let officeDocumentFiles = 0;
  let imageFiles = 0;
  let ignoredFiles = 0;
  let needsOcrFiles = 0;
  const skippedByExtension: Record<string, number> = {};

  function incrementSkipped(extension: string) {
    const key = extension || "无扩展名";
    skippedByExtension[key] = (skippedByExtension[key] ?? 0) + 1;
  }

  async function visit(directory: IterableDirectoryHandle, parentPath: string) {
    for await (const [name, handle] of directory.entries()) {
      const path = parentPath ? `${parentPath}/${name}` : name;

      if (handle.kind === "directory") {
        if ((!parentPath && name === ORGANIZED_ROOT_NAME) || shouldIgnoreKnowledgeDirectory(name)) continue;
        await visit(handle, path);
        continue;
      }

      totalFiles += 1;
      const extension = knowledgeFileExtension(name);
      const category = classifyKnowledgeFile(extension);
      if (category === "image") {
        imageFiles += 1;
        incrementSkipped(extension);
        continue;
      }
      if (category === "ignored") {
        ignoredFiles += 1;
        incrementSkipped(extension);
        continue;
      }

      const readableExtension = extension as LocalKnowledgeExtension;
      const file = await handle.getFile();
      let text = "";
      try {
        text = category === "text"
          ? await file.slice(0, MAX_INDEX_BYTES).text()
          : await extractLocalDocumentText(file, readableExtension);
      } catch {
        ignoredFiles += 1;
        incrementSkipped(extension);
        continue;
      }
      const normalized = text.replace(/\s+/g, " ").trim();
      if (!normalized && category === "office") {
        if (readableExtension === "pdf") needsOcrFiles += 1;
        else ignoredFiles += 1;
        incrementSkipped(extension);
        continue;
      }
      if (!normalized) emptyFiles += 1;
      if (category === "text") textFiles += 1;
      else officeDocumentFiles += 1;

      const frontMatter = category === "text" ? readFrontMatter(text) : { title: undefined, tags: [] as string[] };
      const title = frontMatter.title
        ?? (readableExtension === "md" ? readMarkdownTitle(text) : undefined)
        ?? name.replace(/\.(md|txt|pdf|docx)$/i, "");

      records.push({
        id: `local:${path}`,
        title,
        path,
        extension: readableExtension,
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
  const sortedRecords = records.sort((left, right) => right.lastModified - left.lastModified);
  return {
    records: sortedRecords,
    report: {
      totalFiles,
      readableFiles: sortedRecords.length,
      emptyFiles,
      skippedFiles: totalFiles - sortedRecords.length,
      skippedByExtension,
      textFiles,
      officeDocumentFiles,
      imageFiles,
      ignoredFiles,
      needsOcrFiles,
      scannedAt: new Date().toISOString(),
    } satisfies KnowledgeScanReport,
  };
}

async function writeTextFile(directory: FileSystemDirectoryHandle, name: string, content: string) {
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
}

function safeCopyName(path: string) {
  return path
    .replaceAll("/", "__")
    .replace(/[<>:"\\|?*\u0000-\u001f]/g, "_")
    .slice(-180);
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
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE);
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
