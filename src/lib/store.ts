import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  GenerateRequest,
  GenerateResult,
  InspirationRequest,
  InspirationResult,
  PositioningRequest,
  PositioningResult,
  TopicRadarRequest,
  TopicRadarResult,
} from "./ai";
import type { KnowledgeSource } from "./feishu";

export type StoredRecord<Input, Result> = {
  id: string;
  createdAt: string;
  input: Input;
  result: Result;
};

export type PublicationMetrics = {
  views: number;
  likes: number;
  saves: number;
  comments: number;
  replies: number;
};

export type ArticleRecord = StoredRecord<GenerateRequest, GenerateResult> & {
  publication?: {
    status: "published";
    url?: string;
    publishedAt?: string;
    updatedAt: string;
    metrics: PublicationMetrics;
  };
};

export type MaterialRecord = KnowledgeSource & {
  createdAt: string;
};

export type ContentStore = {
  accountProfiles: Array<StoredRecord<PositioningRequest, PositioningResult>>;
  topicRadars: Array<StoredRecord<TopicRadarRequest, TopicRadarResult>>;
  inspirations: Array<StoredRecord<InspirationRequest, InspirationResult>>;
  materials: MaterialRecord[];
  articles: ArticleRecord[];
};

const storePath = path.join(process.cwd(), "data", "contentfactory.local.json");

const emptyStore: ContentStore = {
  accountProfiles: [],
  topicRadars: [],
  inspirations: [],
  materials: [],
  articles: [],
};

export async function readStore(): Promise<ContentStore> {
  try {
    const content = await readFile(storePath, "utf8");
    const parsed = JSON.parse(content) as Partial<ContentStore>;

    return {
      accountProfiles: parsed.accountProfiles ?? [],
      topicRadars: parsed.topicRadars ?? [],
      inspirations: parsed.inspirations ?? [],
      materials: parsed.materials ?? [],
      articles: parsed.articles ?? [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyStore;
    }

    throw error;
  }
}

export async function saveAccountProfile(input: PositioningRequest, result: PositioningResult) {
  const store = await readStore();
  const record = createRecord("accountProfiles", input, result);

  store.accountProfiles = [record];
  await writeStore(store);

  return record;
}

export async function getCurrentAccountProfile() {
  const store = await readStore();

  return store.accountProfiles.at(-1) ?? null;
}

export async function saveTopicRadar(input: TopicRadarRequest, result: TopicRadarResult) {
  return appendRecord("topicRadars", input, result);
}

export async function saveInspiration(input: InspirationRequest, result: InspirationResult) {
  return appendRecord("inspirations", input, result);
}

export async function saveArticle(input: GenerateRequest, result: GenerateResult) {
  return appendRecord("articles", input, result);
}

export async function saveMaterial(source: KnowledgeSource) {
  const store = await readStore();
  const record: MaterialRecord = {
    ...source,
    createdAt: new Date().toISOString(),
  };
  const existingIndex = store.materials.findIndex((item) => item.id === source.id);

  if (existingIndex >= 0) {
    store.materials[existingIndex] = record;
  } else {
    store.materials.push(record);
  }

  await writeStore(store);
  return record;
}

export async function updateArticlePublication(
  id: string,
  publication: Omit<NonNullable<ArticleRecord["publication"]>, "status" | "updatedAt">,
) {
  const store = await readStore();
  const article = store.articles.find((item) => item.id === id);

  if (!article) {
    return null;
  }

  article.publication = {
    ...publication,
    status: "published",
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);

  return article;
}

export async function getDashboardData() {
  const store = await readStore();
  const recentArticles = [...store.articles].reverse().slice(0, 5);

  return {
    counts: {
      accountProfiles: store.accountProfiles.length,
      topicRadars: store.topicRadars.length,
      inspirations: store.inspirations.length,
      materials: store.materials.length,
      articles: store.articles.length,
      drafts: store.articles.filter((article) => !article.publication).length,
      published: store.articles.filter((article) => article.publication).length,
    },
    recentArticles,
  };
}

async function appendRecord<
  Key extends keyof Pick<ContentStore, "topicRadars" | "inspirations" | "articles">,
>(
  key: Key,
  input: ContentStore[Key][number]["input"],
  result: ContentStore[Key][number]["result"],
) {
  const store = await readStore();
  const record = createRecord(key, input, result);

  store[key] = [...store[key], record] as ContentStore[Key];
  await writeStore(store);

  return record;
}

function createRecord<Key extends keyof Pick<ContentStore, "accountProfiles" | "topicRadars" | "inspirations" | "articles">>(
  key: Key,
  input: ContentStore[Key][number]["input"],
  result: ContentStore[Key][number]["result"],
) {
  return {
    id: createId(key),
    createdAt: new Date().toISOString(),
    input,
    result,
  } as ContentStore[Key][number];
}

async function writeStore(store: ContentStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
