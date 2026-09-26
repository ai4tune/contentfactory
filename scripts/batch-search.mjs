#!/usr/bin/env node

/**
 * 批量搜索历史人文典故科普相关热点文章
 * 使用方法：node scripts/batch-search.mjs
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(PROJECT_ROOT, "data", "contentfactory.db");

// ========== 配置 ==========

// 搜索关键词（三个维度）
const KEYWORDS = {
  // 内容类型
  content: [
    "历史冷知识",
    "历史故事",
    "历史人物",
    "古代生活",
    "历史趣闻",
    "名人轶事",
    "朝代故事",
    "古人日常",
  ],
  // 目标场景
  scene: [
    "给孩子讲的历史",
    "亲子历史",
    "历史启蒙",
    "历史科普",
    "文化常识",
    "国学故事",
  ],
  // 爆款元素
  viral: [
    "颠覆认知的历史",
    "历史真相",
    "你不知道的历史",
    "历史冷知识",
    "涨知识历史",
  ],
};

// 搜索平台
const PLATFORMS = ["xiaohongshu", "wechat"];

// 每个关键词搜索数量
const PAGE_SIZE = 20;

// 搜索间隔（毫秒），避免请求过快
const SEARCH_DELAY = 1000;

// ========== RedFox API 调用 ==========

function getApiKey() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/REDFOX_API_KEY=(.+)/);
  if (!match) {
    throw new Error("未找到 REDFOX_API_KEY，请检查 .env.local");
  }
  return match[1].trim();
}

function getBaseUrl() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const hostMatch = envContent.match(/REDFOX_HOST=(.+)/);
  const baseMatch = envContent.match(/REDFOX_BASE_URL=(.+)/);

  if (baseMatch) return baseMatch[1].trim();
  if (hostMatch) return `https://${hostMatch[1].trim()}`;
  return "https://redfox.hk";
}

async function searchRedfox(platform, keyword, page = 1) {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  // 构建请求参数（与项目中的 redfox-search.ts 保持一致）
  let endpoint, params;

  if (platform === "xiaohongshu") {
    endpoint = "xhs/ability/searchWork";
    params = { keyword, page, sort: "综合", note_type: "不限", noteTime: "不限" };
  } else if (platform === "wechat") {
    endpoint = "gzhData/searchArticle";
    params = { keyword, offset: (page - 1) * 20, sortType: "_0" };
  } else {
    throw new Error(`不支持的平台: ${platform}`);
  }

  const url = `${baseUrl.replace(/\/$/, "")}/story/api/${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "REDFOX_API_KEY": apiKey,
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`API错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // 检查业务错误
  if (data.code !== undefined && Number(data.code) !== 2000) {
    throw new Error(`业务错误 (${data.code}): ${data.msg || data.message || "请求失败"}`);
  }

  return data.data || data;
}

// ========== 数据标准化 ==========

function normalizeItem(raw, platform, keyword) {
  const sourceUrl = raw.noteUrl || raw.workUrl || raw.photoJumpUrl || raw.url || raw.shareUrl || raw.link || "";
  const platformContentId = raw.noteId || raw.workId || raw.workUuid || raw.videoId || raw.id || "";

  return {
    id: `${platform}_${platformContentId || hashStr(sourceUrl || `${raw.authorName}:${raw.noteTitle}`)}`,
    platform,
    platform_content_id: platformContentId,
    source_url: sourceUrl,
    title: raw.noteTitle || raw.title || raw.workTitle || raw.description || "(无标题)",
    summary: raw.summary || raw.desc || raw.workDesc || raw.digest || raw.description || "",
    content_type: raw.noteType === "video" || raw.workType === "video" ? "video" : "article",
    author_name: raw.authorName || raw.accountName || raw.accountNickname || raw.userName || raw.nickname || "",
    author_id: raw.authorUid || raw.authorId || raw.accountUserid || raw.userId || "",
    author_followers: parseNumber(raw.followerCount || raw.followers || raw.fans),
    published_at: raw.releaseTime || raw.publishTime || raw.workPublishTime || raw.publicTime || "",
    views: parseNumber(raw.readCount || raw.clicksCount || raw.playCount || raw.workReadedCount),
    likes: parseNumber(raw.thumbCount || raw.likeCount || raw.workLikedCount || raw.useLikeCount || raw.diggCount),
    collects: parseNumber(raw.favoriteCount || raw.collectCount || raw.workCollectedCount || raw.collectedCount || raw.favCount),
    comments: parseNumber(raw.replyCount || raw.commentCount || raw.workCommentsCount || raw.useCommentCount || raw.commentsCount),
    shares: parseNumber(raw.forwardCount || raw.shareCount || raw.workSharedCount || raw.useShareCount),
    keyword,
    captured_at: new Date().toISOString(),
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim().replaceAll(",", "");
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(万|亿|w|k)?\+?(?:热度)?$/i);
  if (!match) return null;
  const units = { "万": 10000, "亿": 100000000, w: 10000, k: 1000 };
  const parsed = Number(match[1]) * (units[match[2]?.toLowerCase()] || 1);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ========== 数据库操作 ==========

function getDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH, { timeout: 10000 });
  db.pragma("foreign_keys = ON");

  // 确保表存在
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_items (
      id TEXT PRIMARY KEY,
      provider TEXT DEFAULT 'redfox',
      platform TEXT NOT NULL,
      platform_content_id TEXT,
      source_url TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      content_type TEXT DEFAULT 'article',
      author_name TEXT,
      author_id TEXT,
      author_followers INTEGER,
      published_at TEXT,
      captured_at TEXT NOT NULL,
      views INTEGER,
      likes INTEGER,
      collects INTEGER,
      comments INTEGER,
      shares INTEGER,
      keywords TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function saveItem(db, item) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO market_items (
      id, provider, platform, platform_content_id, source_url,
      title, summary, content_type, author_name, author_id,
      author_followers, published_at, captured_at,
      views, likes, collects, comments, shares,
      keywords, updated_at
    ) VALUES (
      ?, 'redfox', ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, datetime('now')
    )
  `);

  stmt.run(
    item.id, item.platform, item.platform_content_id || null, item.source_url || null,
    item.title, item.summary || null, item.content_type, item.author_name || null, item.author_id || null,
    item.author_followers ?? null, item.published_at || null, item.captured_at,
    item.views ?? null, item.likes ?? null, item.collects ?? null, item.comments ?? null, item.shares ?? null,
    item.keyword ? JSON.stringify([item.keyword]) : null
  );
}

// ========== 主流程 ==========

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 开始批量搜索历史人文典故科普热点文章\n");

  const db = getDatabase();
  const allKeywords = [
    ...KEYWORDS.content,
    ...KEYWORDS.scene,
    ...KEYWORDS.viral,
  ];

  // 去重
  const uniqueKeywords = [...new Set(allKeywords)];

  console.log(`📋 搜索关键词 (${uniqueKeywords.length}个):`);
  console.log(uniqueKeywords.join("、"));
  console.log(`\n📱 搜索平台: ${PLATFORMS.join("、")}`);
  console.log(`📊 每个关键词搜索: ${PAGE_SIZE}条`);
  console.log(`⏱️  搜索间隔: ${SEARCH_DELAY}ms\n`);

  let totalSaved = 0;
  let totalErrors = 0;
  const results = [];

  for (const keyword of uniqueKeywords) {
    for (const platform of PLATFORMS) {
      const platformName = platform === "xiaohongshu" ? "小红书" : "公众号";

      try {
        console.log(`🔍 搜索 [${platformName}] ${keyword}...`);

        const data = await searchRedfox(platform, keyword, 1);

        // 解析结果
        const list = data.workList || data.list || data.articles || [];
        if (!Array.isArray(list) || list.length === 0) {
          console.log(`   ⚠️  无结果`);
          continue;
        }

        // 标准化并保存
        let saved = 0;
        for (const raw of list) {
          try {
            const item = normalizeItem(raw, platform, keyword);
            saveItem(db, item);
            saved++;
          } catch (e) {
            console.log(`   ⚠️  保存失败: ${e.message}`);
          }
        }

        totalSaved += saved;
        console.log(`   ✅ 找到 ${list.length} 条，保存 ${saved} 条`);

        results.push({
          keyword,
          platform: platformName,
          found: list.length,
          saved,
        });

        // 搜索间隔
        await sleep(SEARCH_DELAY);

      } catch (error) {
        totalErrors++;
        console.log(`   ❌ 搜索失败: ${error.message}`);
        results.push({
          keyword,
          platform: platformName,
          found: 0,
          saved: 0,
          error: error.message,
        });
      }
    }
  }

  db.close();

  // 输出统计
  console.log("\n" + "=".repeat(50));
  console.log("📊 搜索完成统计");
  console.log("=".repeat(50));
  console.log(`✅ 成功保存: ${totalSaved} 条`);
  console.log(`❌ 失败次数: ${totalErrors}`);
  console.log(`📁 数据库位置: ${DB_PATH}`);

  // 保存搜索日志
  const logPath = path.join(PROJECT_ROOT, "data", "batch-search-log.json");
  fs.writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    keywords: uniqueKeywords,
    platforms: PLATFORMS,
    totalSaved,
    totalErrors,
    results,
  }, null, 2));
  console.log(`📝 搜索日志: ${logPath}`);

  console.log("\n💡 下一步: 运行 node scripts/export-csv.mjs 导出CSV文件");
}

main().catch(error => {
  console.error("💥 脚本执行失败:", error);
  process.exit(1);
});
