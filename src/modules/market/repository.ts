// 市场模块仓库
// 用于存储和检索市场数据

import type {
  MarketItem,
  MarketAccount,
  MarketMetricSnapshot,
  MarketPlatform,
} from "./types";

// 内存存储（第一阶段使用 JSON，后续可迁移到 SQLite）
const marketItemsStore: Map<string, MarketItem> = new Map();
const marketAccountsStore: Map<string, MarketAccount> = new Map();
const metricSnapshotsStore: Map<string, MarketMetricSnapshot[]> = new Map();

// 保存市场项目
export function saveMarketItem(item: MarketItem): MarketItem {
  marketItemsStore.set(item.id, item);
  return item;
}

// 批量保存市场项目
export function saveMarketItems(items: MarketItem[]): MarketItem[] {
  for (const item of items) {
    marketItemsStore.set(item.id, item);
  }
  return items;
}

// 获取市场项目
export function getMarketItem(id: string): MarketItem | null {
  return marketItemsStore.get(id) || null;
}

// 列出市场项目
export function listMarketItems(filters?: {
  platform?: MarketPlatform;
  keyword?: string;
  minHotScore?: number;
  limit?: number;
  offset?: number;
}): MarketItem[] {
  let items = Array.from(marketItemsStore.values());

  if (filters?.platform) {
    items = items.filter((item) => item.platform === filters.platform);
  }

  if (filters?.keyword) {
    const keyword = filters.keyword.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) ||
        item.summary?.toLowerCase().includes(keyword) ||
        item.keywords.some((k) => k.toLowerCase().includes(keyword))
    );
  }

  // 按捕获时间倒序
  items.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

  const offset = filters?.offset || 0;
  const limit = filters?.limit || 50;

  return items.slice(offset, offset + limit);
}

// 删除市场项目
export function deleteMarketItem(id: string): boolean {
  return marketItemsStore.delete(id);
}

// 保存市场账号
export function saveMarketAccount(account: MarketAccount): MarketAccount {
  marketAccountsStore.set(account.id, account);
  return account;
}

// 获取市场账号
export function getMarketAccount(id: string): MarketAccount | null {
  return marketAccountsStore.get(id) || null;
}

// 列出市场账号
export function listMarketAccounts(filters?: {
  platform?: MarketPlatform;
  accountType?: MarketAccount["accountType"];
  limit?: number;
}): MarketAccount[] {
  let accounts = Array.from(marketAccountsStore.values());

  if (filters?.platform) {
    accounts = accounts.filter((account) => account.platform === filters.platform);
  }

  if (filters?.accountType) {
    accounts = accounts.filter((account) => account.accountType === filters.accountType);
  }

  // 按更新时间倒序
  accounts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const limit = filters?.limit || 50;

  return accounts.slice(0, limit);
}

// 删除市场账号
export function deleteMarketAccount(id: string): boolean {
  return marketAccountsStore.delete(id);
}

// 保存指标快照
export function saveMetricSnapshot(snapshot: MarketMetricSnapshot): MarketMetricSnapshot {
  const snapshots = metricSnapshotsStore.get(snapshot.marketItemId) || [];
  snapshots.push(snapshot);
  metricSnapshotsStore.set(snapshot.marketItemId, snapshots);
  return snapshot;
}

// 获取指标快照
export function getMetricSnapshots(marketItemId: string): MarketMetricSnapshot[] {
  return metricSnapshotsStore.get(marketItemId) || [];
}

// 获取最新指标快照
export function getLatestMetricSnapshot(marketItemId: string): MarketMetricSnapshot | null {
  const snapshots = metricSnapshotsStore.get(marketItemId) || [];
  if (snapshots.length === 0) return null;

  // 按捕获时间倒序，返回最新的
  snapshots.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  return snapshots[0];
}

// 计算账号中位数指标
export function calculateAccountMedianMetrics(accountId: string): MarketItem["metrics"] | null {
  const account = getMarketAccount(accountId);
  if (!account) return null;

  // 获取该账号的所有作品
  const items = Array.from(marketItemsStore.values()).filter(
    (item) => item.author.id === accountId || item.author.name === account.name
  );

  if (items.length === 0) return null;

  // 计算中位数
  const likes = items.map((item) => item.metrics.likes || 0).sort((a, b) => a - b);
  const collects = items.map((item) => item.metrics.collects || 0).sort((a, b) => a - b);
  const comments = items.map((item) => item.metrics.comments || 0).sort((a, b) => a - b);
  const shares = items.map((item) => item.metrics.shares || 0).sort((a, b) => a - b);
  const views = items.map((item) => item.metrics.views || 0).sort((a, b) => a - b);

  const mid = Math.floor(items.length / 2);

  return {
    views: views[mid],
    likes: likes[mid],
    collects: collects[mid],
    comments: comments[mid],
    shares: shares[mid],
  };
}

// 检查内容是否已存在（去重）
export function isDuplicate(item: MarketItem): boolean {
  // 1. 检查平台内容 ID
  if (item.platformContentId) {
    const existing = Array.from(marketItemsStore.values()).find(
      (existing) =>
        existing.platform === item.platform &&
        existing.platformContentId === item.platformContentId
    );
    if (existing) return true;
  }

  // 2. 检查 canonical URL
  if (item.canonicalUrl) {
    const existing = Array.from(marketItemsStore.values()).find(
      (existing) => existing.canonicalUrl === item.canonicalUrl
    );
    if (existing) return true;
  }

  // 3. 检查内容指纹
  const existing = Array.from(marketItemsStore.values()).find((existing) => {
    if (existing.platform !== item.platform) return false;
    if (existing.author.name !== item.author.name) return false;

    const existingTitle = existing.title.toLowerCase().replace(/\s+/g, "");
    const newTitle = item.title.toLowerCase().replace(/\s+/g, "");
    if (existingTitle !== newTitle) return false;

    if (existing.publishedAt && item.publishedAt) {
      const existingDate = new Date(existing.publishedAt).toISOString().split("T")[0];
      const newDate = new Date(item.publishedAt).toISOString().split("T")[0];
      return existingDate === newDate;
    }

    return true;
  });

  return !!existing;
}

// 清空存储（用于测试）
export function clearAll(): void {
  marketItemsStore.clear();
  marketAccountsStore.clear();
  metricSnapshotsStore.clear();
}
