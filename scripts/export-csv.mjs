#!/usr/bin/env node

/**
 * 从数据库导出爆款文章为CSV
 * 使用方法：node scripts/export-csv.mjs
 *
 * 可选参数：
 *   --min-likes=100      最少点赞数
 *   --min-collects=50    最少收藏数
 *   --limit=1000         最多导出数量
 *   --platform=xiaohongshu  只导出指定平台
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(PROJECT_ROOT, "data", "contentfactory.db");

// ========== 解析命令行参数 ==========

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    minLikes: 0,
    minCollects: 0,
    minViews: 0,
    limit: 1000,
    platform: null,
    output: null,
  };

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    switch (key) {
      case "min-likes":
        config.minLikes = parseInt(value) || 0;
        break;
      case "min-collects":
        config.minCollects = parseInt(value) || 0;
        break;
      case "min-views":
        config.minViews = parseInt(value) || 0;
        break;
      case "limit":
        config.limit = parseInt(value) || 1000;
        break;
      case "platform":
        config.platform = value;
        break;
      case "output":
        config.output = value;
        break;
    }
  }

  return config;
}

// ========== CSV 工具函数 ==========

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // 如果包含逗号、双引号或换行，需要用双引号包裹
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(rows, columns) {
  const header = columns.map(col => escapeCSV(col.label)).join(",");
  const dataRows = rows.map(row =>
    columns.map(col => escapeCSV(col.getValue(row))).join(",")
  );
  return [header, ...dataRows].join("\n");
}

// ========== 主流程 ==========

function main() {
  const config = parseArgs();

  console.log("📊 导出爆款文章CSV\n");

  // 检查数据库
  if (!fs.existsSync(DB_PATH)) {
    console.error("❌ 数据库不存在，请先运行 batch-search.mjs");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // 构建查询
  let sql = `
    SELECT
      id,
      platform,
      title,
      summary,
      author_name,
      author_id,
      author_followers,
      source_url,
      published_at,
      views,
      likes,
      collects,
      comments,
      shares,
      keywords,
      captured_at
    FROM market_items
    WHERE 1=1
  `;
  const params = [];

  // 平台过滤
  if (config.platform) {
    sql += " AND platform = ?";
    params.push(config.platform);
  }

  // 互动数据过滤（取点赞、收藏、评论中最高的作为排序依据）
  if (config.minLikes > 0) {
    sql += " AND (likes IS NOT NULL AND likes >= ?)";
    params.push(config.minLikes);
  }
  if (config.minCollects > 0) {
    sql += " AND (collects IS NOT NULL AND collects >= ?)";
    params.push(config.minCollects);
  }
  if (config.minViews > 0) {
    sql += " AND (views IS NOT NULL AND views >= ?)";
    params.push(config.minViews);
  }

  // 排序：按互动数据综合排序（点赞*3 + 收藏*2 + 评论*1）
  sql += `
    ORDER BY
      COALESCE(likes, 0) * 3 +
      COALESCE(collects, 0) * 2 +
      COALESCE(comments, 0) DESC
    LIMIT ?
  `;
  params.push(config.limit);

  // 查询
  console.log("🔍 查询数据库...");
  const rows = db.prepare(sql).all(...params);
  db.close();

  if (rows.length === 0) {
    console.log("⚠️  没有符合条件的数据");
    console.log("\n💡 提示：");
    console.log("  - 先运行 node scripts/batch-search.mjs 搜索数据");
    console.log("  - 或者降低过滤条件：--min-likes=0");
    process.exit(0);
  }

  console.log(`✅ 找到 ${rows.length} 条数据\n`);

  // 定义CSV列
  const columns = [
    { label: "标题", getValue: row => row.title },
    { label: "摘要", getValue: row => row.summary },
    { label: "平台", getValue: row => row.platform === "xiaohongshu" ? "小红书" : "公众号" },
    { label: "作者", getValue: row => row.author_name },
    { label: "作者粉丝", getValue: row => row.author_followers },
    { label: "链接", getValue: row => row.source_url },
    { label: "发布时间", getValue: row => row.published_at },
    { label: "阅读量", getValue: row => row.views },
    { label: "点赞数", getValue: row => row.likes },
    { label: "收藏数", getValue: row => row.collects },
    { label: "评论数", getValue: row => row.comments },
    { label: "分享数", getValue: row => row.shares },
    { label: "搜索关键词", getValue: row => {
      try {
        const keywords = JSON.parse(row.keywords);
        return Array.isArray(keywords) ? keywords.join("; ") : row.keywords;
      } catch {
        return row.keywords || "";
      }
    }},
    { label: "采集时间", getValue: row => row.captured_at },
    { label: "互动总分", getValue: row => {
      const likes = row.likes || 0;
      const collects = row.collects || 0;
      const comments = row.comments || 0;
      return likes * 3 + collects * 2 + comments;
    }},
  ];

  // 生成CSV
  const csv = generateCSV(rows, columns);

  // 输出文件
  const timestamp = new Date().toISOString().slice(0, 10);
  const defaultFilename = `历史人文爆款_${timestamp}_${rows.length}条.csv`;
  const outputPath = config.output
    ? path.resolve(config.output)
    : path.join(PROJECT_ROOT, "data", defaultFilename);

  fs.writeFileSync(outputPath, "﻿" + csv, "utf-8"); // BOM for Excel

  console.log("📁 CSV已导出:");
  console.log(`   ${outputPath}`);
  console.log(`\n📊 数据统计:`);

  // 统计
  const platformStats = {};
  const keywordStats = {};

  for (const row of rows) {
    // 平台统计
    const platformName = row.platform === "xiaohongshu" ? "小红书" : "公众号";
    platformStats[platformName] = (platformStats[platformName] || 0) + 1;

    // 关键词统计
    try {
      const keywords = JSON.parse(row.keywords);
      if (Array.isArray(keywords)) {
        for (const kw of keywords) {
          keywordStats[kw] = (keywordStats[kw] || 0) + 1;
        }
      }
    } catch {}
  }

  console.log("\n   平台分布:");
  for (const [platform, count] of Object.entries(platformStats).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${platform}: ${count} 条`);
  }

  console.log("\n   热门关键词 Top10:");
  const topKeywords = Object.entries(keywordStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [keyword, count] of topKeywords) {
    console.log(`     ${keyword}: ${count} 条`);
  }

  // 互动数据统计
  const totalLikes = rows.reduce((sum, r) => sum + (r.likes || 0), 0);
  const totalCollects = rows.reduce((sum, r) => sum + (r.collects || 0), 0);
  const avgLikes = Math.round(totalLikes / rows.length);
  const avgCollects = Math.round(totalCollects / rows.length);

  console.log("\n   互动数据:");
  console.log(`     平均点赞: ${avgLikes}`);
  console.log(`     平均收藏: ${avgCollects}`);

  console.log("\n💡 提示: CSV文件可以用Excel打开，支持筛选和排序");
}

main();
