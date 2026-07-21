export type LocalKnowledgeItem = {
  id: string;
  title: string;
  path: string;
  extension: "md" | "txt";
  size: number;
  lastModified: number;
  tags: string[];
  excerpt: string;
  searchText: string;
  indexedAt: string;
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
