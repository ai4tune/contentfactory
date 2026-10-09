import type { LocalKnowledgeItem } from "./types";

export type KnowledgeFileCategory = "text" | "office" | "image" | "ignored";

const TEXT_EXTENSIONS = new Set(["md", "txt"]);
const OFFICE_EXTENSIONS = new Set(["pdf", "docx"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "tif", "tiff", "bmp"]);
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".cache",
  ".obsidian",
  ".venv",
  "__pycache__",
  "node_modules",
  "coverage",
  "dist",
  "build",
  "target",
  "vendor",
  "venv",
  "logs",
  "tmp",
  "temp",
]);
const BUSINESS_HINTS = [
  "企业",
  "公司",
  "品牌",
  "介绍",
  "产品",
  "服务",
  "菜单",
  "价格",
  "客户",
  "案例",
  "活动",
  "经营",
  "定位",
  "内容",
  "常见问题",
  "faq",
];

export function knowledgeFileExtension(name: string) {
  return name.includes(".") ? name.split(".").pop()?.toLocaleLowerCase() ?? "" : "";
}

export function classifyKnowledgeFile(extension: string): KnowledgeFileCategory {
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (OFFICE_EXTENSIONS.has(extension)) return "office";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return "ignored";
}

export function shouldIgnoreKnowledgeDirectory(name: string) {
  const normalized = name.toLocaleLowerCase();
  return normalized.startsWith(".") || IGNORED_DIRECTORY_NAMES.has(normalized);
}

export function recommendKnowledgeItems(items: LocalKnowledgeItem[], limit = 30) {
  return items
    .filter((item) => item.searchText.trim() || (item.needsRecognition && !["heic", "heif", "tif", "tiff"].includes(item.extension)))
    .map((item, index) => ({ item, index, score: recommendationScore(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

function recommendationScore(item: LocalKnowledgeItem) {
  const searchable = `${item.title} ${item.path}`.toLocaleLowerCase();
  const businessScore = BUSINESS_HINTS.reduce(
    (score, hint) => score + (searchable.includes(hint) ? 10 : 0),
    0,
  );
  const documentScore = item.extension === "pdf" || item.extension === "docx" ? 2 : 0;
  return businessScore + documentScore;
}
