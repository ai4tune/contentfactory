# 批量搜索脚本使用说明

## 功能概述

批量搜索历史人文典故科普相关的热点文章，用于公众号运营参考。

## 使用步骤

### 1. 批量搜索

```bash
node scripts/batch-search.mjs
```

**搜索范围：**
- 平台：小红书、公众号
- 关键词：约20个（历史冷知识、历史故事、亲子历史等）
- 每个关键词：20条
- 预计数据量：400-600条

**搜索完成后：**
- 数据自动保存到 `data/contentfactory.db`
- 搜索日志保存到 `data/batch-search-log.json`

### 2. 导出CSV

```bash
node scripts/export-csv.mjs
```

**可选参数：**
```bash
# 只导出高互动数据（点赞>=100）
node scripts/export-csv.mjs --min-likes=100

# 只导出小红书数据
node scripts/export-csv.mjs --platform=xiaohongshu

# 限制导出数量
node scripts/export-csv.mjs --limit=500

# 指定输出文件
node scripts/export-csv.mjs --output=./my-data.csv

# 组合使用
node scripts/export-csv.mjs --min-likes=50 --min-collects=30 --limit=1000
```

**默认导出：**
- 所有数据按互动分数排序（点赞×3 + 收藏×2 + 评论×1）
- 最多1000条
- 输出到 `data/历史人文爆款_日期_数量条.csv`

## CSV字段说明

| 字段 | 说明 |
|------|------|
| 标题 | 文章标题 |
| 摘要 | 文章摘要/描述 |
| 平台 | 小红书/公众号 |
| 作者 | 作者名称 |
| 作者粉丝 | 作者粉丝数 |
| 链接 | 原文链接 |
| 发布时间 | 文章发布时间 |
| 阅读量 | 阅读/播放次数 |
| 点赞数 | 点赞次数 |
| 收藏数 | 收藏次数 |
| 评论数 | 评论次数 |
| 分享数 | 分享/转发次数 |
| 搜索关键词 | 搜索时使用的关键词 |
| 采集时间 | 数据采集时间 |
| 互动总分 | 综合互动分数 |

## 注意事项

1. **API调用限制**：每次搜索间隔1秒，避免请求过快
2. **数据缓存**：相同关键词30分钟内不会重复搜索
3. **费用**：RedFox API按调用次数收费，请确认账户余额
4. **去重**：同一平台同一内容只保存一条

## 扩展关键词

如需添加更多关键词，编辑 `batch-search.mjs` 中的 `KEYWORDS` 对象：

```javascript
const KEYWORDS = {
  content: [
    "历史冷知识",
    "历史故事",
    // 添加更多...
  ],
  // ...
};
```

## 后续优化

- [ ] 支持抖音、视频号平台
- [ ] 支持分页搜索（获取更多数据）
- [ ] 支持时间范围筛选
- [ ] 导出到飞书多维表格
- [ ] 自动筛选爆款（基于互动数据阈值）
