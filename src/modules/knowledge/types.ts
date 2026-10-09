export type LocalKnowledgeExtension = "md" | "txt" | "pdf" | "docx" | "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "heic" | "heif" | "tif" | "tiff";

export type LocalKnowledgeItem = {
  id: string;
  title: string;
  path: string;
  extension: LocalKnowledgeExtension;
  size: number;
  lastModified: number;
  tags: string[];
  excerpt: string;
  searchText: string;
  indexedAt: string;
  needsRecognition?: boolean;
  recognizedText?: string;
};

export type KnowledgeScanReport = {
  totalFiles: number;
  readableFiles: number;
  emptyFiles: number;
  skippedFiles: number;
  skippedByExtension: Record<string, number>;
  addedFiles?: number;
  updatedFiles?: number;
  reusedFiles?: number;
  retainedFiles?: number;
  textFiles?: number;
  officeDocumentFiles?: number;
  imageFiles?: number;
  ignoredFiles?: number;
  needsOcrFiles?: number;
  failedFiles?: { path: string; reason: string }[];
  scannedAt: string;
};

export type KnowledgeScanProgress = {
  phase: "connecting" | "scanning" | "reading" | "saving";
  checkedFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  currentPath?: string;
};

export type KnowledgePreview = {
  id: string;
  title: string;
  source: "local" | "feishu" | "base" | "upload";
  text: string;
  path?: string;
  url?: string;
  lastModified?: number;
};

export type RemoteKnowledgeSource = {
  id: string;
  title: string;
  source: "feishu" | "base";
  url?: string;
  updatedAt: string;
};
