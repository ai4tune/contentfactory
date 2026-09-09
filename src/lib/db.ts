// 数据库基础设施
// 使用 better-sqlite3 作为本地数据库

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 数据目录
const DATA_DIR = path.join(process.cwd(), "data");

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据库文件路径
const DB_PATH = path.join(DATA_DIR, "contentfactory.db");

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式
db.pragma("journal_mode = WAL");

// 启用外键约束
db.pragma("foreign_keys = ON");

// 确保列存在（增量迁移）
function ensureColumn(table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const exists = columns.some((col) => col.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

// 初始化数据库表
function initializeDatabase(): void {
  // 市场项目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_items (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_item_id TEXT,
      platform TEXT NOT NULL,
      platform_content_id TEXT,
      canonical_url TEXT,
      source_url TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      body TEXT,
      content_type TEXT NOT NULL DEFAULT 'unknown',
      author_id TEXT,
      author_name TEXT,
      author_followers INTEGER,
      author_profile_url TEXT,
      published_at TEXT,
      captured_at TEXT NOT NULL,
      views INTEGER,
      likes INTEGER,
      collects INTEGER,
      comments INTEGER,
      shares INTEGER,
      keywords TEXT,
      tags TEXT,
      raw_payload_ref TEXT,
      opportunity_score INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 市场指标快照表
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_metric_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_item_id TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      views INTEGER,
      likes INTEGER,
      collects INTEGER,
      comments INTEGER,
      shares INTEGER,
      FOREIGN KEY (market_item_id) REFERENCES market_items(id)
    )
  `);

  // 追踪账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_accounts (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_account_id TEXT,
      name TEXT NOT NULL,
      profile_url TEXT,
      followers INTEGER,
      works_count INTEGER,
      account_type TEXT NOT NULL DEFAULT 'benchmark',
      latest_post_at TEXT,
      average_engagement REAL,
      median_engagement REAL,
      viral_count INTEGER DEFAULT 0,
      main_topics TEXT,
      captured_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 追踪账号作品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_account_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      market_item_id TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES tracked_accounts(id),
      FOREIGN KEY (market_item_id) REFERENCES market_items(id)
    )
  `);

  // 搜索历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT,
      result_count INTEGER,
      searched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 提供者调用日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      cache_hit INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER DEFAULT 0,
      cost_estimate REAL,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 提供者缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_cache (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      response TEXT NOT NULL,
      status_code INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 选题表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      source_url TEXT,
      platform TEXT,
      market_item_id TEXT,
      status TEXT NOT NULL DEFAULT 'pool',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_market_items_platform ON market_items(platform);
    CREATE INDEX IF NOT EXISTS idx_market_items_captured_at ON market_items(captured_at);
    CREATE INDEX IF NOT EXISTS idx_market_items_opportunity_score ON market_items(opportunity_score);
    CREATE INDEX IF NOT EXISTS idx_tracked_accounts_platform ON tracked_accounts(platform);
    CREATE INDEX IF NOT EXISTS idx_provider_cache_key ON provider_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_provider_call_logs_provider ON provider_call_logs(provider);
    CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
  `);

  // 去重唯一约束：同一平台同一内容只保留一条
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_market_items_platform_content
      ON market_items(platform, platform_content_id)
      WHERE platform_content_id IS NOT NULL AND platform_content_id != ''
    `);
  } catch {
    // 索引可能已存在，忽略
  }
}

// 初始化数据库
initializeDatabase();

// 导出数据库实例和工具函数
export { db, ensureColumn, DATA_DIR, DB_PATH };

// 保存市场项目
export function saveMarketItemToDb(item: {
  id: string;
  provider: string;
  providerItemId?: string;
  platform: string;
  platformContentId?: string;
  canonicalUrl?: string;
  sourceUrl?: string;
  title: string;
  summary?: string;
  body?: string;
  contentType: string;
  authorId?: string;
  authorName?: string;
  authorFollowers?: number;
  authorProfileUrl?: string;
  publishedAt?: string;
  capturedAt: string;
  views?: number;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  keywords?: string[];
  tags?: string[];
  rawPayloadRef?: string;
  opportunityScore?: number;
}): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO market_items (
      id, provider, provider_item_id, platform, platform_content_id,
      canonical_url, source_url, title, summary, body, content_type,
      author_id, author_name, author_followers, author_profile_url,
      published_at, captured_at, views, likes, collects, comments, shares,
      keywords, tags, raw_payload_ref, opportunity_score, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, datetime('now')
    )
  `);

  stmt.run(
    item.id,
    item.provider,
    item.providerItemId || null,
    item.platform,
    item.platformContentId || null,
    item.canonicalUrl || null,
    item.sourceUrl || null,
    item.title,
    item.summary || null,
    item.body || null,
    item.contentType,
    item.authorId || null,
    item.authorName || null,
    item.authorFollowers || null,
    item.authorProfileUrl || null,
    item.publishedAt || null,
    item.capturedAt,
    item.views || null,
    item.likes || null,
    item.collects || null,
    item.comments || null,
    item.shares || null,
    item.keywords ? JSON.stringify(item.keywords) : null,
    item.tags ? JSON.stringify(item.tags) : null,
    item.rawPayloadRef || null,
    item.opportunityScore || null
  );
}

// 去重保存市场项目（更新指标，保护已有正文和分析）
export function upsertMarketItemToDb(item: {
  id: string;
  provider: string;
  providerItemId?: string;
  platform: string;
  platformContentId?: string;
  canonicalUrl?: string;
  sourceUrl?: string;
  title: string;
  summary?: string;
  body?: string;
  contentType: string;
  authorId?: string;
  authorName?: string;
  authorFollowers?: number;
  authorProfileUrl?: string;
  publishedAt?: string;
  capturedAt: string;
  views?: number;
  likes?: number;
  collects?: number;
  comments?: number;
  shares?: number;
  keywords?: string[];
  tags?: string[];
  rawPayloadRef?: string;
  opportunityScore?: number;
}): void {
  // 先尝试按 platform_content_id 查找已有记录
  let existingId: string | null = null;
  if (item.platformContentId) {
    const existing = db.prepare(
      "SELECT id FROM market_items WHERE platform = ? AND platform_content_id = ?"
    ).get(item.platform, item.platformContentId) as { id: string } | undefined;
    existingId = existing?.id ?? null;
  }

  if (existingId) {
    // 更新：只覆盖指标和基础信息，保护已有正文
    const stmt = db.prepare(`
      UPDATE market_items SET
        title = ?, summary = COALESCE(?, summary),
        source_url = COALESCE(?, source_url), canonical_url = COALESCE(?, canonical_url),
        author_name = COALESCE(?, author_name), author_followers = COALESCE(?, author_followers),
        published_at = COALESCE(?, published_at),
        views = COALESCE(?, views), likes = COALESCE(?, likes),
        collects = COALESCE(?, collects), comments = COALESCE(?, comments), shares = COALESCE(?, shares),
        opportunity_score = COALESCE(?, opportunity_score),
        updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(
      item.title, item.summary || null,
      item.sourceUrl || null, item.canonicalUrl || null,
      item.authorName || null, item.authorFollowers || null,
      item.publishedAt || null,
      item.views || null, item.likes || null,
      item.collects || null, item.comments || null, item.shares || null,
      item.opportunityScore || null,
      existingId
    );
  } else {
    // 新记录：直接插入
    saveMarketItemToDb(item);
  }
}

// 获取市场项目
export function getMarketItemFromDb(id: string): Record<string, unknown> | null {
  const stmt = db.prepare("SELECT * FROM market_items WHERE id = ?");
  return stmt.get(id) as Record<string, unknown> | null;
}

// 列出市场项目
export function listMarketItemsFromDb(filters?: {
  platform?: string;
  keyword?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}): Record<string, unknown>[] {
  let sql = "SELECT * FROM market_items WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.platform) {
    sql += " AND platform = ?";
    params.push(filters.platform);
  }

  if (filters?.keyword) {
    sql += " AND (title LIKE ? OR summary LIKE ? OR keywords LIKE ?)";
    const keyword = `%${filters.keyword}%`;
    params.push(keyword, keyword, keyword);
  }

  if (filters?.minScore) {
    sql += " AND opportunity_score >= ?";
    params.push(filters.minScore);
  }

  sql += " ORDER BY captured_at DESC";

  if (filters?.limit) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }

  if (filters?.offset) {
    sql += " OFFSET ?";
    params.push(filters.offset);
  }

  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

// 保存提供者调用日志
export function saveProviderCallLog(log: {
  provider: string;
  endpoint: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  cacheHit: boolean;
  itemCount: number;
  costEstimate?: number;
  errorCode?: string;
  errorMessage?: string;
}): void {
  const stmt = db.prepare(`
    INSERT INTO provider_call_logs (
      provider, endpoint, started_at, finished_at,
      success, cache_hit, item_count, cost_estimate,
      error_code, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.provider,
    log.endpoint,
    log.startedAt,
    log.finishedAt,
    log.success ? 1 : 0,
    log.cacheHit ? 1 : 0,
    log.itemCount,
    log.costEstimate || null,
    log.errorCode || null,
    log.errorMessage || null
  );
}

// 获取提供者缓存
export function getProviderCache(cacheKey: string): Record<string, unknown> | null {
  const stmt = db.prepare("SELECT * FROM provider_cache WHERE cache_key = ?");
  return stmt.get(cacheKey) as Record<string, unknown> | null;
}

// 设置提供者缓存
export function setProviderCache(cacheKey: string, provider: string, endpoint: string, response: string, statusCode?: number): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO provider_cache (cache_key, provider, endpoint, response, status_code, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(cacheKey, provider, endpoint, response, statusCode || 200);
}

// 清理过期缓存
export function cleanupExpiredCache(maxAgeHours: number = 24): number {
  const stmt = db.prepare(`
    DELETE FROM provider_cache
    WHERE updated_at < datetime('now', ? || ' hours')
  `);
  const result = stmt.run(`-${maxAgeHours}`);
  return result.changes;
}

// ========== Ideas CRUD ==========

export function saveIdeaToDb(idea: {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  platform?: string;
  marketItemId?: string;
  status?: string;
}): void {
  const stmt = db.prepare(`
    INSERT INTO ideas (id, title, summary, source_url, platform, market_item_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    idea.id,
    idea.title,
    idea.summary || null,
    idea.sourceUrl || null,
    idea.platform || null,
    idea.marketItemId || null,
    idea.status || "pool"
  );
}

export function getIdeaFromDb(id: string): Record<string, unknown> | null {
  const stmt = db.prepare("SELECT * FROM ideas WHERE id = ?");
  return stmt.get(id) as Record<string, unknown> | null;
}

export function listIdeasFromDb(status?: string): Record<string, unknown>[] {
  if (status) {
    return db.prepare("SELECT * FROM ideas WHERE status = ? ORDER BY created_at DESC").all(status) as Record<string, unknown>[];
  }
  return db.prepare("SELECT * FROM ideas ORDER BY created_at DESC").all() as Record<string, unknown>[];
}

export function updateIdeaStatus(id: string, status: string): void {
  db.prepare("UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}
