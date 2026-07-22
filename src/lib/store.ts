import path from "node:path";
import { readJsonFile, updateJsonFile } from "./local-store/json-file";
import type { AccountContext } from "@/modules/positioning/types";
import type { AccountCapture } from "@/modules/positioning/capture";
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
  accountContext: AccountContext | null;
  accountCaptures: AccountCapture[];
  accountProfiles: Array<StoredRecord<PositioningRequest, PositioningResult>>;
  topicRadars: Array<StoredRecord<TopicRadarRequest, TopicRadarResult>>;
  inspirations: Array<StoredRecord<InspirationRequest, InspirationResult>>;
  materials: MaterialRecord[];
  articles: ArticleRecord[];
};

const storePath = path.join(process.cwd(), "data", "contentfactory.local.json");

const emptyStore: ContentStore = {
  accountContext: null,
  accountCaptures: [],
  accountProfiles: [],
  topicRadars: [],
  inspirations: [],
  materials: [],
  articles: [],
};

export async function readStore(): Promise<ContentStore> {
  const parsed = await readJsonFile<Partial<ContentStore>>(storePath, emptyStore);

  return normalizeStore(parsed);
}

export async function updateStore(update: (store: ContentStore) => ContentStore) {
  return updateJsonFile<Partial<ContentStore>>(storePath, emptyStore, (current) =>
    update(normalizeStore(current)),
  ) as Promise<ContentStore>;
}

export async function saveAccountProfile(input: PositioningRequest, result: PositioningResult) {
  const record = createRecord("accountProfiles", input, result);
  await updateStore((store) => ({ ...store, accountProfiles: [record] }));

  return record;
}

export async function saveAccountCapture(capture: AccountCapture) {
  await updateStore((store) => ({
    ...store,
    accountCaptures: [...store.accountCaptures, capture].slice(-100),
  }));
  return capture;
}

export async function getLatestAccountCapture() {
  const store = await readStore();
  return store.accountCaptures.at(-1) ?? null;
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
  const record: MaterialRecord = {
    ...source,
    createdAt: new Date().toISOString(),
  };
  await updateStore((store) => {
    const materials = [...store.materials];
    const existingIndex = materials.findIndex((item) => item.id === source.id);

    if (existingIndex >= 0) materials[existingIndex] = record;
    else materials.push(record);

    return { ...store, materials };
  });
  return record;
}

export async function updateArticlePublication(
  id: string,
  publication: Omit<NonNullable<ArticleRecord["publication"]>, "status" | "updatedAt">,
) {
  let updatedArticle: ArticleRecord | null = null;
  await updateStore((store) => ({
    ...store,
    articles: store.articles.map((article) => {
      if (article.id !== id) return article;
      updatedArticle = {
        ...article,
        publication: { ...publication, status: "published", updatedAt: new Date().toISOString() },
      };
      return updatedArticle;
    }),
  }));

  return updatedArticle;
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
  const record = createRecord(key, input, result);
  await updateStore((store) => ({
    ...store,
    [key]: [...store[key], record],
  }));

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

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStore(parsed: Partial<ContentStore>): ContentStore {
  return {
    accountContext: parsed.accountContext ?? null,
    accountCaptures: parsed.accountCaptures ?? [],
    accountProfiles: parsed.accountProfiles ?? [],
    topicRadars: parsed.topicRadars ?? [],
    inspirations: parsed.inspirations ?? [],
    materials: parsed.materials ?? [],
    articles: parsed.articles ?? [],
  };
}
