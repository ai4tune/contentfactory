# Content Factory V2 / AI Growth OS v2.0 升级规格说明书

> 建议文件名：`docs/specs/AI-Growth-OS-Spec-v2.0.md`  
> 产品名称：Content Factory / 内容工厂  
> 内部产品定位：AI Growth OS / 企业内容增长工作台  
> 版本：v2.0 Draft  
> 状态：升级设计基线  
> 主要读者：产品负责人、Codex、Claude Code、Cursor、开发者、测试人员、实施顾问  
> 上一版本：`docs/specs/AI-Growth-OS-Spec-v1.0.md`  
> 参考项目：`coracoo/insprira`  
> 数据能力参考：RedFox API / redfox-community  
> 本文原则：借鉴产品思想、信息架构与业务闭环，不复制 Inspira 源代码、视觉资产、文案和具体实现。

---

# 0. 文档目标

本 Spec 用于指导 Content Factory 从当前的：

> **企业知识驱动的 AI 内容生产工具**

升级为：

> **市场情报 → 机会判断 → 企业知识 → 内容生产 → 发布审核 → 运营复盘 → 下一轮增长**

的一体化企业内容增长工作台。

V2 不推翻 V1。

V1 已经完成的以下能力原则上全部保留：

- 当前账号定位；
- 企业知识库；
- 本地 Markdown / TXT；
- 飞书知识连接；
- 临时上传；
- 个人/品牌表达风格；
- 原创内容；
- 爆款改写；
- 统一 Content Brief；
- 公众号；
- 小红书；
- 朋友圈；
- 短视频脚本；
- 小红书视觉卡片；
- AI Review；
- Review Issue；
- Apply / Ignore；
- 人工确认；
- 内容版本；
- 发布记录；
- 阅读、点赞、收藏、评论等指标记录；
- Chrome 插件主动采集能力；
- API Acceptance Test。

V1 当前已经形成了较完整的 `ContentBrief → ContentProject → ChannelDraft → Review → Publication` 内容生产链路，同时 `InspirationRecord` 已经具备平台身份、作者、互动指标、指标快照、AI 拆解和使用记录等字段，因此 V2 应以增量扩展为主，而不是重做内容核心。 

---

# 1. V2 升级背景

## 1.1 当前 V1 的优势

当前 Content Factory 的优势主要集中在内容生产后半段。

现有流程：

```text
账号定位
↓
企业知识
↓
选题
↓
Content Brief
↓
公众号 / 小红书 / 朋友圈 / 短视频
↓
AI Review
↓
人工修改
↓
确认可发布
↓
发布
↓
记录表现
```

当前 README 已经明确将产品定位为单企业、客户知识优先、本地文件和飞书优先，并保存 Brief、渠道草稿、引用、Review 和实际发布指标。

这些能力不应因 V2 引入市场雷达而削弱。

---

## 1.2 当前 V1 的主要问题

问题不是“不会生成内容”。

真正的问题是：

### 问题 A：外部市场信号弱

系统目前主要回答：

> 我有什么资料？

> 我能写什么？

但不能稳定回答：

> 市场现在正在关注什么？

> 我的目标客户最近对什么感兴趣？

> 哪些内容正在快速上涨？

> 哪些小账号突然跑出了异常爆款？

---

### 问题 B：选题雷达仍然依赖人工输入市场材料

当前 `/topics` 已经有：

- 定位；
- 客群；
- 产品；
- 平台；
- 关键词；
- 爆款样本；
- 选题候选；
- 验证清单。

但是爆款样本目前仍要求用户手工粘贴。

页面明确保留了“MVP 阶段不自动抓取平台”的历史约束。

RedFox 已经使这个限制不再必要。

---

### 问题 C：首页偏“统计”，不够“诊断”

当前首页已经有：

- 当前账号；
- 内容定位；
- 内容支柱；
- 知识素材数量；
- 内容项目；
- 已审核；
- 已发布；
- 阅读；
- 点赞；
- 最近内容。

但用户打开系统之后仍然要自己判断：

> 数据意味着什么？

> 我的问题在哪里？

> 今天应该做什么？

> 最近有什么机会？

---

### 问题 D：产品信息架构无法体现真实能力

当前一级导航主要是：

```text
首页
内容创作
当前账号
个人风格
知识库
草稿历史
内容库
```

而实际上项目中已经存在：

```text
/topics
/inspirations
```

以及完整的选题雷达和爆款库代码。

但用户无法从主导航直接感知。

---

### 问题 E：缺少持续运营机制

当前系统更像：

> 用户进来 → 发起一次操作 → 获得一次结果。

未来应该变成：

> 系统持续观察 → 主动发现问题和机会 → 用户处理 → 系统复盘。

---

# 2. Inspira 借鉴结论

## 2.1 应重点借鉴的内容

Inspira 的优势不是某一个 API。

其核心价值在于把数据和功能组织成了一个真正可日常使用的运营工作台。

重点借鉴：

1. 运营总览思想；
2. LLM 运营总结；
3. 问题分布；
4. 账号概览；
5. 热榜；
6. 热词；
7. 数据新鲜度；
8. 数据源展示；
9. 灵感搜索；
10. 灵感生命周期；
11. 收藏 / 喜欢 / 不喜欢；
12. 关键词屏蔽；
13. 一键进入创作；
14. 账号追踪；
15. Skill 中心；
16. Agent 对话；
17. CRON 自动任务；
18. 违禁词检测；
19. 本地缓存；
20. 数据失败状态透明展示。

Inspira 首页会把真实账号和文章数据进一步整理为运营总结、关键问题、本周行动和亮点，并允许行动项标记完成或忽略，而不是只展示 KPI。

热榜模块也不仅仅显示 API 数据，而是继续处理数据日期、抓取时间、来源、缓存、平台适配和自动刷新。

---

## 2.2 不应直接借鉴的内容

不建议照搬：

- Inspira 源代码；
- 原有 Node 大文件结构；
- 原生 JS 页面体系；
- 具体 UI 像素布局；
- 配色；
- 图标组合；
- 文案；
- 特定 CSS；
- 账号诊断算法原实现；
- 一开始支持十多个平台；
- 任意 Skill 直接执行的开放模式；
- 所有能力全部自动调用 LLM；
- 过度偏“个人自媒体运营”的产品定位。

原则：

> **借业务问题的解决方式，不借具体实现。**

---

# 3. V2 产品重新定位

## 3.1 产品名称

对内：

> AI Growth OS

对外第一阶段仍可继续：

> 内容工厂

更成熟后可考虑：

> 企业内容增长工作台

---

# 3.2 一句话定位

帮助企业持续发现市场机会，并结合自己的产品、案例、观点和知识，生产真正适合目标客户的内容，通过发布数据和线索结果不断优化下一轮内容。

---

# 3.3 核心价值公式

```text
外部市场需求
×
企业自身知识
×
老板/品牌表达
×
AI生产效率
×
真实运营反馈
=
企业内容增长系统
```

---

# 3.4 V2 核心价值

V2 必须持续回答五个问题：

### ① 市场正在关注什么？

由市场雷达解决。

### ② 哪些机会适合我？

由机会判断引擎解决。

### ③ 我有哪些内容可以支撑？

由企业知识库解决。

### ④ 我该怎么表达？

由账号定位、品牌风格、Brief 和内容工厂解决。

### ⑤ 什么内容真正有效？

由运营复盘和商业反馈解决。

---

# 4. V2 总体业务闭环

```text
                        ┌──────────────┐
                        │   外部市场   │
                        └──────┬───────┘
                               ↓
                  小红书 / 抖音 / 视频号
                    公众号 / 其他平台
                               ↓
                        RedFox Provider
                               ↓
                     ┌────────────────┐
                     │    市场雷达    │
                     │ 热榜/搜索/趋势 │
                     │ 爆款/低粉爆款  │
                     │   对标账号     │
                     └───────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │   机会判断引擎   │
                    │ HotScore        │
                    │ RelativeScore   │
                    │ AudienceFit     │
                    │ BusinessScore   │
                    │ KnowledgeFit    │
                    └───────┬─────────┘
                            ↓
                     ┌───────────────┐
                     │  灵感与选题   │
                     │ 发现→收藏     │
                     │ 研究→待写     │
                     └───────┬───────┘
                             ↓
            ┌────────────────┴─────────────────┐
            ↓                                  ↓
     ┌──────────────┐                  ┌──────────────┐
     │ 企业知识库   │                  │ 账号与品牌   │
     │ 产品/案例    │                  │ 定位/客群    │
     │ FAQ/观点     │                  │ 风格/目标    │
     └──────┬───────┘                  └──────┬───────┘
            └────────────────┬─────────────────┘
                             ↓
                       Content Brief
                             ↓
                       ┌───────────┐
                       │ 内容工厂  │
                       └─────┬─────┘
                             ↓
       公众号 / 小红书 / 朋友圈 / 短视频
                             ↓
                    ┌─────────────────┐
                    │   发布前检查    │
                    │ 合规/事实/品牌  │
                    │ 平台/AI味/CTA   │
                    └────────┬────────┘
                             ↓
                           发布
                             ↓
                    ┌────────────────┐
                    │    运营复盘    │
                    │ 阅读/互动/线索 │
                    │ 咨询/商机/成交 │
                    └───────┬────────┘
                            ↓
                    ┌────────────────┐
                    │   运营驾驶舱   │
                    │ 问题/亮点/行动 │
                    │ 市场机会       │
                    └───────┬────────┘
                            │
                            └────→ 下一轮
```

---

# 5. V2 产品原则

## 5.1 市场数据不是产品价值终点

RedFox 只负责：

> 告诉系统“外部发生了什么”。

Content Factory 的核心价值是：

> 判断这些变化跟当前企业有什么关系。

---

## 5.2 企业事实优先于外部爆款

外部内容可以学习：

- 选题；
- Hook；
- 内容结构；
- 节奏；
- 情绪；
- 用户需求；
- 表达形式。

但：

- 公司事实；
- 产品信息；
- 客户案例；
- ROI；
- 服务能力；
- 观点；

必须优先来自企业自己的知识。

---

## 5.3 外部市场和内部知识必须真正融合

理想选题不是：

> “这个话题很火。”

而是：

> “这个话题正在上涨，而且企业自己有足够证据可以写。”

---

## 5.4 数据必须可追溯

任何：

- 热榜；
- 爆款；
- 选题；
- 评分；

都应尽可能保留：

```text
provider
platform
sourceUrl
platformContentId
capturedAt
publishedAt
sourceKeyword
metricSnapshots
```

---

## 5.5 AI 不替代最终判断

涉及：

- 企业事实；
- 品牌；
- 发布；
- 合规；
- 商业承诺；

必须保留人工确认。

---

# 6. 新信息架构

## 6.1 一级导航

V2 将当前扁平导航升级为分组式导航。

建议：

```text
内容增长

  首页
  市场雷达
  灵感与选题

内容生产

  内容工厂
  内容项目
  内容库

企业资产

  企业知识库
  账号与品牌

AI 能力

  AI 员工
  Skill 中心
  自动任务

运营

  运营复盘

----------------

设置
```

---

# 6.2 一级导航职责

| 一级菜单 | 核心问题 |
|---|---|
| 首页 | 现在运营得怎么样、应该做什么 |
| 市场雷达 | 外面正在发生什么 |
| 灵感与选题 | 什么值得写 |
| 内容工厂 | 怎么把选题变成内容 |
| 内容项目 | 当前生产到哪里 |
| 内容库 | 已经生产和发布了什么 |
| 企业知识库 | 企业有哪些内容资产 |
| 账号与品牌 | 我是谁、写给谁、怎么表达 |
| AI员工 | 用自然语言完成复杂工作 |
| Skill中心 | 系统拥有哪些能力 |
| 自动任务 | 哪些工作不需要人工触发 |
| 运营复盘 | 什么内容真正有效 |
| 设置 | 模型、RedFox、飞书等配置 |

---

# 7. 路由规划

建议最终路由：

```text
/

/radar
/radar/hot
/radar/search
/radar/trends
/radar/accounts

/ideas
/ideas/search
/ideas/pool
/ideas/viral
/ideas/:id

/create

/projects
/projects/:id

/articles
/articles/:id

/knowledge

/brand
/brand/positioning
/brand/style

/ai
/ai/agent
/ai/skills
/ai/automations

/analytics

/settings
```

---

# 7.1 旧路由迁移

当前：

```text
/topics
```

逐步迁移到：

```text
/ideas/search
```

当前：

```text
/inspirations
```

逐步迁移到：

```text
/ideas/viral
```

短期保留 Redirect，避免破坏现有链接。

---

# 8. 首页——企业内容增长驾驶舱

## 8.1 页面目标

用户打开首页 5 秒内必须能回答：

1. 现在运营得怎么样？
2. 最大的问题是什么？
3. 最近有哪些市场机会？
4. 今天应该做什么？

---

# 8.2 首页页面结构

建议：

```text
┌────────────────────────────────────┐
│ Content Growth Dashboard           │
│ 本周内容增长总览                    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ AI 运营总结                         │
│ 整体判断                            │
│ 关键问题 / 本周行动 / 亮点          │
└────────────────────────────────────┘

┌───────────────┬────────────────────┐
│ 账号运营概览  │ 市场机会           │
└───────────────┴────────────────────┘

┌───────────────┬────────────────────┐
│ 内容问题分布  │ 知识资产健康度     │
└───────────────┴────────────────────┘

┌────────────────────────────────────┐
│ 核心 KPI                           │
└────────────────────────────────────┘

┌───────────────┬────────────────────┐
│ 最近内容      │ 待处理任务         │
└───────────────┴────────────────────┘
```

---

# 8.3 AI 运营总结

必须包含：

### overall

本周整体运营情况。

### keyProblems

最多 3～5 个真正值得处理的问题。

### actions

最多 3～5 个本周行动。

### highlights

近期明显表现不错的内容和方向。

### marketOpportunities

最近新出现的市场机会。

---

# 8.4 行动项状态

借鉴 Inspira 的闭环思想。

每个 Action：

```ts
type OperationAction = {
  id: string;
  text: string;
  type:
    | "create_content"
    | "follow_topic"
    | "improve_knowledge"
    | "optimize_account"
    | "review_content"
    | "other";
  targetId?: string;
  status: "pending" | "done" | "dismissed";
  createdAt: string;
  updatedAt: string;
};
```

---

# 8.5 行动必须可以执行

例如：

> 跟进「AI员工」热点。

点击：

```text
/radar/search?q=AI员工
```

而不是单纯文字。

---

# 8.6 首页 KPI

V2 不只看内容数量。

第一阶段：

```text
知识素材
内容项目
已审核
已发布
阅读量
互动量
市场机会
待写选题
```

后续：

```text
私信
加微信
咨询
有效线索
商机
成交
```

---

# 8.7 首页“账号运营概览”

展示：

```text
平台
近7天发布数
近7天表现
环比
内容健康度
当前问题
建议
```

---

# 8.8 首页“问题分布”

第一版：

```text
选题
标题
内容结构
事实证据
平台适配
品牌风格
AI味
合规风险
CTA
```

---

# 8.9 知识资产健康度

分类：

```text
公司介绍
产品与服务
解决方案
客户案例
客户痛点
FAQ
老板观点
销售话术
行业观点
证明材料
历史内容
```

展示：

```text
产品资料        85%
案例资料        42%
FAQ             61%
老板观点        28%
```

---

# 9. 市场雷达

## 9.1 定位

市场雷达解决：

> **外部市场正在发生什么？**

---

# 9.2 V2 P0 平台

正式支持：

```text
小红书
抖音
视频号
```

P1：

```text
公众号
```

P2：

```text
B站
知乎
其他
```

---

# 9.3 市场雷达 Tab

```text
热榜
主题搜索
趋势
对标账号
```

---

# 10. 热榜

## 10.1 页面目标

不用输入关键词，直接看：

> 今天/本周什么内容正在受到关注。

---

# 10.2 内容结构

顶部：

### 全网热词

例如：

```text
AI员工
超级个体
AI获客
一人公司
销售自动化
```

下面：

### 平台热榜 Tab

```text
小红书
抖音
视频号
公众号
```

---

# 10.3 热榜数据必须展示来源状态

借鉴 Inspira。

每个平台显示：

```text
数据来源
榜单日期
抓取时间
缓存状态
最近接口状态
自动刷新状态
```

---

# 10.4 每条内容展示

至少：

```text
排名
标题
作者
平台
发布时间
点赞
收藏
评论
分享
播放/阅读
数据更新时间
```

---

# 10.5 操作

每条内容支持：

```text
查看详情
收藏
AI拆解
生成选题
开始创作
追踪作者
```

---

# 11. 主题搜索 / 灵感搜索

## 11.1 页面目标

输入：

```text
AI获客
```

得到：

```text
关联关键词
相关热词
热门内容
低粉爆款
趋势变化
代表账号
AI洞察
推荐选题
```

---

# 11.2 查询流程

```text
用户关键词
↓
Keyword Expander
↓
生成5～10个相关关键词
↓
RedFox Search
↓
平台统一数据标准化
↓
去重
↓
基础热度排序
↓
企业相关度评分
↓
AI分析
↓
输出机会
```

---

# 11.3 Keyword Expansion

例如：

输入：

```text
AI获客
```

生成：

```text
AI营销
AI销售
企业AI
AI员工
内容获客
老板用AI
销售自动化
AI私域
AI线索
企业智能体
```

---

# 12. Market Provider 架构

## 12.1 绝对禁止业务层直接绑定 RedFox

新增：

```text
src/modules/market/providers/
```

---

# 12.2 Provider Interface

```ts
interface MarketDataProvider {
  searchWorks(input: SearchWorksInput): Promise<MarketItem[]>;
  getTrending(input: TrendingInput): Promise<MarketItem[]>;
  getAccount(input: AccountInput): Promise<MarketAccount>;
  getAccountWorks(input: AccountWorksInput): Promise<MarketItem[]>;
  getComments?(input: CommentsInput): Promise<MarketComment[]>;
}
```

---

# 12.3 第一实现

```text
RedFoxProvider
```

以后允许：

```text
TikHubProvider
ManualProvider
BrowserProvider
```

---

# 13. MarketItem 统一数据模型

```ts
type MarketPlatform =
  | "xiaohongshu"
  | "douyin"
  | "channels"
  | "wechat"
  | "bilibili"
  | "zhihu"
  | "other";

type MarketMetrics = {
  views?: number | null;
  likes?: number | null;
  collects?: number | null;
  comments?: number | null;
  shares?: number | null;
};

type MarketItem = {
  id: string;

  provider: string;
  providerItemId?: string;

  platform: MarketPlatform;
  platformContentId?: string;

  canonicalUrl?: string;
  sourceUrl?: string;

  title: string;
  summary?: string;
  body?: string;

  contentType:
    | "article"
    | "image"
    | "video"
    | "unknown";

  author: {
    id?: string;
    name?: string;
    followers?: number | null;
    profileUrl?: string;
  };

  publishedAt?: string;
  capturedAt: string;

  metrics: MarketMetrics;

  keywords: string[];
  tags: string[];

  rawPayloadRef?: string;
};
```

---

# 14. 指标快照

任何进入：

```text
爆款库
选题池
重点追踪
```

的内容都允许保存 MetricSnapshot。

```ts
type MarketMetricSnapshot = {
  marketItemId: string;
  capturedAt: string;
  metrics: MarketMetrics;
};
```

后续可以计算：

```text
增长速度
24h涨幅
72h涨幅
```

---

# 15. 去重规则

优先级：

### 1. 平台内容 ID

```text
platform + platformContentId
```

### 2. Canonical URL

### 3. 内容 Fingerprint

```text
platform
+
author
+
normalized title
+
published date
```

---

# 16. 数据源成本控制

RedFox 按调用产生数据成本。

因此：

### 搜索结果必须缓存。

推荐 Cache Key：

```text
platform
+
keyword
+
filters
+
page
```

---

# 16.1 默认缓存

普通搜索：

```text
6～12 小时
```

热榜：

```text
按照平台数据更新周期
```

详情：

```text
24 小时
```

---

# 16.2 不重复调用原则

同一个：

```text
关键词 + 平台 + 时间窗口
```

在缓存新鲜时不得重复调用 Provider。

---

# 17. 机会判断引擎

这是 Content Factory V2 与普通热点工具最重要的差异之一。

---

# 17.1 五类评分

## HotScore

衡量绝对市场表现。

## RelativeScore

衡量相对当前作者正常水平的异常程度。

## AudienceFit

目标客户匹配度。

## BusinessScore

商业价值。

## KnowledgeFit

企业自身是否有足够材料可以写。

---

# 17.2 最终机会评分

```text
OpportunityScore
```

不建议完全隐藏计算过程。

UI 应同时展示：

```text
市场热度       88
相对爆款       82
客户匹配       97
商业价值       94
知识匹配       91

机会指数       92
```

---

# 17.3 第一阶段建议公式

```text
OpportunityScore =
  HotScore * 0.20
+ RelativeScore * 0.20
+ AudienceFit * 0.25
+ BusinessScore * 0.20
+ KnowledgeFit * 0.15
```

公式应配置化。

不得写死在 UI。

---

# 17.4 HotScore

不同平台单独归一化。

严禁：

> 直接比较抖音播放量和小红书收藏量。

应在：

```text
同平台
+
同关键词
+
同时间窗口
```

内做：

```text
percentile
log normalization
```

---

# 17.5 RelativeScore

第一版：

```text
当前作品互动
/
该账号最近20篇中位互动
```

互动定义按平台配置。

例如：

### 小红书

```text
like
+ collect * 1.5
+ comment * 2
+ share * 2
```

---

# 17.6 RelativeScore 判断区间

初始配置：

```text
< 2      普通
2～3     较好
3～5     爆款
>= 5     异常爆款
```

配置化，不作为永久业务规则。

---

# 18. 趋势页面

趋势不是简单展示“今天谁最高”。

目标：

> 找到正在上涨的方向。

---

# 18.1 时间窗口

第一阶段：

```text
7天
14天
30天
```

---

# 18.2 趋势状态

```text
rising
stable
cooling
new
```

中文：

```text
上涨
稳定
降温
新出现
```

---

# 18.3 趋势卡片

显示：

```text
关键词
7日热度
14日热度
增长率
相关爆款数
企业匹配度
企业已有相关知识数量
```

---

# 19. 对标账号

## 19.1 类型

```text
own
competitor
benchmark
inspiration
```

中文：

```text
自己账号
竞争账号
对标账号
参考账号
```

---

# 19.2 数据

```text
平台
账号名
粉丝
作品数
更新时间
近期平均互动
近期中位互动
爆款数量
异常爆款数量
主要内容方向
```

---

# 19.3 对标账号价值

系统应该回答：

> 最近这个账号什么内容明显跑出来了？

而不是：

> 这个账号有多少粉丝？

---

# 20. 灵感与选题

## 20.1 新定位

当前：

```text
/topics
+
/inspirations
```

升级后统一成为：

> **灵感与选题**

---

# 20.2 Tab

```text
发现
推荐
选题池
爆款库
已使用
```

---

# 21. “发现”

来源：

```text
市场搜索
热榜
趋势
账号追踪
人工录入
浏览器插件
Agent
```

---

# 22. “推荐”

系统根据：

```text
市场趋势
+
企业定位
+
目标客户
+
企业知识
+
历史表现
```

自动推荐：

```text
今天值得写
本周值得写
长期值得写
```

---

# 23. 选题生命周期

借鉴 Inspira “选题 CRM” 思想。

```text
discovered
↓
saved
↓
researching
↓
ready
↓
creating
↓
published
↓
reviewed
↓
archived
```

中文：

```text
发现
已收藏
研究中
待创作
创作中
已发布
已复盘
已归档
```

---

# 24. IdeaRecord

```ts
type IdeaStatus =
  | "discovered"
  | "saved"
  | "researching"
  | "ready"
  | "creating"
  | "published"
  | "reviewed"
  | "archived";

type IdeaRecord = {
  id: string;

  title: string;
  summary: string;

  status: IdeaStatus;

  source:
    | "market"
    | "knowledge"
    | "manual"
    | "agent"
    | "ai";

  sourceMarketItemIds: string[];
  sourceKnowledgeIds: string[];

  keywords: string[];

  targetAudience?: string;
  angle?: string;
  contentGoal?: string;

  opportunityScore?: OpportunityScore;

  feedback: {
    state:
      | "none"
      | "like"
      | "dislike"
      | "block";
    reason?: string;
  };

  isFavorite: boolean;

  contentProjectIds: string[];

  createdAt: string;
  updatedAt: string;
};
```

---

# 25. 用户反馈机制

每个 Idea：

```text
👍 感兴趣
👎 不感兴趣
🚫 不要再推荐这类
⭐ 收藏
```

---

# 25.1 Block 处理

Block 不等于简单删除。

应形成：

```text
TopicPreference
```

例如：

```text
negativeKeywords
negativeThemes
negativePlatforms
```

后续推荐减少出现。

---

# 26. 爆款库

当前 `InspirationRecord` Schema V2 已经比较成熟，不建议删除。

V2 应继续保留它作为：

> **已经进入深度研究阶段的外部内容样本。**

---

# 26.1 MarketItem 与 InspirationRecord 关系

```text
MarketItem
=
外部市场原始标准化内容

InspirationRecord
=
被用户选中的重点研究样本
```

流程：

```text
MarketItem
↓ 收藏 / AI拆解
InspirationRecord
```

---

# 26.2 InspirationRecord 新增字段

建议新增：

```ts
opportunityScore?: OpportunityScore;
marketItemId?: string;

usageStatus?:
  | "unused"
  | "idea_created"
  | "creating"
  | "published";

businessInsights?: {
  customerPainPoints: string[];
  buyingSignals: string[];
  objections: string[];
  transferableAngles: string[];
};
```

---

# 27. 评论洞察

不要给所有结果抓评论。

第一阶段：

> 只有进入深度研究的 Top 10～20 内容抓评论。

---

# 27.1 评论分析

重点提取：

```text
用户问题
痛点
争议
购买意图
案例
反对意见
需求语言
```

最终只保存：

```text
3～5条高价值洞察
```

避免永久保存无意义的大量评论全文。

---

# 28. 内容工厂

## 28.1 原则

现有内容创作链路原则上不重写。

保留：

```text
ContentBrief
ContentProject
ChannelDraft
Review
Version
Publication
```

当前 `ContentBrief` 已经能够保存知识 Citation 和 InspirationReference，是 V2 市场内容进入创作链路的重要基础。

---

# 28.2 三种创作入口

以后 Content Factory 支持：

### A. 自己输入主题

```text
用户 → Content Factory
```

### B. 从选题开始

```text
Idea → Content Factory
```

### C. 从爆款开始

```text
MarketItem
↓
Inspiration
↓
Content Factory
```

---

# 29. 内容创作左右结构

推荐：

```text
┌─────────────────────────────┐
│ 当前创作目标                 │
└─────────────────────────────┘

┌──────────────┬──────────────┐
│ 内部事实     │ 外部市场证据 │
│ 企业知识     │ 爆款/趋势    │
│ 品牌观点     │ 用户需求     │
└──────────────┴──────────────┘

              ↓

          Content Brief

              ↓

       多渠道内容生成
```

---

# 29.1 外部参考明确标记

任何引用爆款结构时显示：

```text
参考了什么
为什么参考
准备如何改造
哪些不能复制
```

继续使用现有：

```text
ContentInspirationPlan
```

中的：

```text
adopt
adapt
discard
```

思想。

---

# 30. Content Brief V2

建议追加：

```ts
marketContext?: {
  trendKeywords: string[];
  sourceMarketItemIds: string[];
  opportunityScore?: number;
  customerSignals: string[];
};

businessGoal?: {
  stage:
    | "awareness"
    | "trust"
    | "lead"
    | "conversion";

  desiredAction?: string;
};
```

---

# 31. 发布前检查

## 31.1 不单独做“违禁词工具”

统一升级：

> **发布前检查 / Content QA**

---

# 31.2 检查维度

### 合规

```text
平台违禁词
极限词
广告法风险
医疗/金融等特殊风险
导流风险
```

### 事实

```text
数字缺少证据
产品能力夸大
案例不可验证
来源不清
```

### 内容

```text
标题过长
结构重复
表达冗余
AI味
低信息密度
```

### 平台

```text
小红书适配
公众号适配
朋友圈适配
短视频适配
```

### 品牌

```text
品牌风格
老板风格
禁用表达
核心定位
```

### 转化

```text
CTA是否存在
CTA是否过硬
目标动作是否一致
```

---

# 31.3 Review 类型扩展

当前 Review Category：

```text
fact
style
platform
human_writing
```



扩展为：

```ts
export const reviewIssueCategories = [
  "fact",
  "style",
  "platform",
  "human_writing",

  "compliance",
  "ad_law",
  "prohibited_word",
  "brand",
  "cta",
] as const;
```

---

# 31.4 保留现有 Apply / Ignore

这是当前系统非常好的交互。

任何问题：

```text
查看问题
↓
接受修改
或
忽略
```

必须继续保留。

---

# 31.5 Content Health Score

第一阶段可展示：

```text
内容健康度 87 / 100

高风险：1
中风险：3
建议优化：5
```

健康度必须是辅助信息。

不能用一个分数遮蔽具体风险。

---

# 32. 企业知识库

## 32.1 保留现有技术方向

继续保留：

```text
本地 Markdown / TXT
飞书
临时上传
```

---

# 32.2 V2 重点不是“多接几个知识库”

重点升级：

> **知识结构化程度。**

---

# 32.3 KnowledgeCategory

```ts
type KnowledgeCategory =
  | "company"
  | "product"
  | "solution"
  | "case"
  | "customer_pain"
  | "faq"
  | "founder_opinion"
  | "sales_script"
  | "industry"
  | "proof"
  | "pricing"
  | "historical_content"
  | "other";
```

---

# 32.4 知识资产健康度

根据：

```text
数量
覆盖
新鲜度
内容完整度
```

形成：

```text
产品资料        85%
案例资料        42%
FAQ             61%
老板观点        28%
```

---

# 32.5 缺口建议

例如：

> 当前知识库已经有大量产品说明，但缺少可以公开使用的客户案例。

> AI 创作时容易重复产品功能，建议补充真实客户问题。

---

# 33. 账号与品牌

当前：

```text
当前账号
个人风格
```

从两个一级菜单合并为：

> **账号与品牌**

---

# 33.1 Tab

```text
企业定位
目标客户
产品与服务
内容定位
品牌表达
个人风格
转化目标
```

---

# 33.2 底层模块不要求立刻合并

当前：

```text
src/modules/positioning
src/modules/style-profile
```

继续保留。

V2 第一阶段只是：

> UI 和信息架构合并。

避免没有收益的技术重构。

---

# 34. 内容项目

原：

```text
草稿历史
```

建议改名：

> **内容项目**

因为已经不是单纯草稿。

---

# 34.1 状态

```text
选题确认
Brief完成
生成中
审核中
可发布
已发布
已复盘
```

---

# 35. 内容库

内容库继续保留。

但分为：

```text
全部内容
已发布
高表现
低表现
带来线索
已成交关联
```

---

# 36. 内容商业反馈

这是企业版与普通自媒体工具应该真正拉开的地方。

除：

```text
阅读
点赞
收藏
评论
回复
```

未来追加：

```text
私信
加微信
咨询
有效线索
商机
成交
```

---

# 36.1 PublicationMetrics V2

建议：

```ts
type PublicationMetrics = {
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares?: number;
  replies: number;

  directMessages?: number;
  wechatAdds?: number;
  inquiries?: number;
  qualifiedLeads?: number;
  opportunities?: number;
  deals?: number;

  revenue?: number;
};
```

第一阶段全部允许：

> 手工回填。

不要因此建设复杂 CRM。

---

# 36.2 商业价值判断

系统以后可以识别：

```text
文章A：
100000阅读
0线索

文章B：
3000阅读
8个咨询
2个成交
```

不能简单判断 A 更好。

---

# 37. 运营复盘

## 37.1 时间维度

```text
7天
30天
季度
自定义
```

---

# 37.2 核心分析

### 内容表现

### 平台表现

### 主题表现

### 内容类型表现

### 商业结果

### 市场趋势跟进情况

---

# 37.3 Topic Performance

例如：

```text
AI员工

内容数：6
总阅读：28,000
平均互动率：6.2%
线索：8
商机：3
```

以后系统可以真正回答：

> 哪些主题值得继续写？

---

# 38. AI运营总结

LLM 输入不使用全部原始数据。

先由程序生成结构化摘要：

```text
accountStats
contentStats
topicStats
marketStats
knowledgeHealth
leadStats
previousActions
```

再交给模型。

---

# 38.1 输出 Schema

```ts
type OperationSummary = {
  overall: string;

  keyProblems: Array<{
    title: string;
    detail: string;
    evidence: string[];
  }>;

  actions: Array<{
    text: string;
    reason: string;
    actionType: string;
    targetId?: string;
  }>;

  highlights: Array<{
    title: string;
    detail: string;
  }>;

  marketOpportunities: Array<{
    keyword: string;
    reason: string;
    score?: number;
  }>;
};
```

---

# 38.2 调用策略

借鉴 Inspira 的成本意识。

禁止：

> 首页每刷新一次就调一次 LLM。

建议：

```text
每周自动一次
+
用户手工重新生成
```

---

# 39. Skill 中心

## 39.1 定位

不是一开始做开放插件市场。

第一版：

> **系统能力中心。**

---

# 39.2 Skill 分类

### 数据

```text
小红书搜索
抖音搜索
视频号搜索
公众号搜索
低粉爆款
账号追踪
```

### 分析

```text
爆款拆解
标题分析
评论需求分析
机会评分
客户匹配
商业价值
```

### 创作

```text
公众号
小红书
朋友圈
视频脚本
案例文章
老板IP
```

### 审核

```text
违禁词
广告法
事实校验
平台适配
品牌检查
AI味检查
```

---

# 39.3 SkillDefinition

```ts
type SkillDefinition = {
  id: string;
  name: string;
  description: string;

  category:
    | "data"
    | "analysis"
    | "creation"
    | "review";

  provider:
    | "builtin"
    | "redfox"
    | "custom";

  version: string;

  enabled: boolean;

  estimatedCost?: string;

  permissions: string[];

  capabilities: string[];
};
```

---

# 39.4 RedFox Community

RedFox Community 可以作为：

> Skill 设计、能力分类和接口调用的重要参考来源。

但自己的核心系统不要求直接运行其完整 Skill 脚本。

更推荐：

```text
Skill UI
↓
内部 Action
↓
Market Provider / Analysis Service
```

---

# 40. Agent

## 40.1 Agent 不是聊天机器人

Agent 的定义：

> 可以通过自然语言调用 Content Factory 内部真实业务能力。

---

# 40.2 示例

用户：

> 最近 AI 获客有什么值得写？

系统：

```text
market.search
↓
market.rank
↓
knowledge.match
↓
idea.recommend
```

返回 5 个选题。

---

用户：

> 第三个不错，存下来。

系统：

```text
idea.create
```

---

用户：

> 给我写成公众号。

系统：

```text
content.createProject
↓
content.generateBrief
↓
content.generateChannel
```

---

# 40.3 Agent Action 第一批

```text
market.search
market.hot
market.trackAccount

idea.create
idea.update
idea.favorite

knowledge.search

content.createProject
content.generateBrief
content.generateChannel

review.run

analytics.summary
```

---

# 40.4 Agent UI

建议右下角或独立页：

```text
AI 员工
```

但必须展示：

```text
正在调用什么能力
找到什么数据
创建了什么资产
```

不能黑盒。

---

# 41. 自动任务

## 41.1 第一批任务

```text
每日热点同步
关键词监控
账号追踪
爆款发现
每周运营总结
下周选题建议
```

---

# 41.2 ScheduledJob

```ts
type ScheduledJob = {
  id: string;

  name: string;

  type:
    | "hot_sync"
    | "keyword_watch"
    | "account_refresh"
    | "viral_detection"
    | "weekly_summary"
    | "topic_recommendation";

  enabled: boolean;

  cron: string;

  config: Record<string, unknown>;

  lastRunAt?: string;
  lastRunStatus?: "success" | "failed";

  nextRunAt?: string;
};
```

---

# 41.3 UI

用户可以：

```text
启用
暂停
立即运行
查看最近运行
查看失败原因
```

---

# 42. 通知

第一阶段只做系统内通知即可。

后续考虑：

```text
飞书机器人
微信
邮件
```

例如：

> “AI员工”进入近7天上涨 Top3，同时检测到你知识库有14条可用资料。

---

# 43. 数据存储升级

## 43.1 当前现状

V1 刻意使用：

```text
JSON
IndexedDB
```

避免过早建设数据库。

这个决策在 V1 是正确的。

---

# 43.2 V2 新变化

市场模块会引入：

```text
大量 MarketItem
指标快照
搜索运行
账号追踪
趋势
定时任务
Provider缓存
```

不再适合纯 JSON。

---

# 43.3 迁移原则

不得一次性全量数据库重构。

---

# 43.4 第一阶段继续 JSON

继续保留：

```text
AccountContext
StyleProfile
ContentProject
ContentDraft
Publication
```

---

# 43.5 新模块直接 SQLite

```text
market_items
market_metric_snapshots

tracked_accounts
tracked_account_posts

radar_runs
topic_watchlists

ideas

operation_summaries
operation_actions

scheduled_jobs
job_runs

provider_cache
provider_calls
```

---

# 44. SQLite 技术建议

建议：

```text
better-sqlite3
```

或项目技术栈中合适的稳定 SQLite 客户端。

必须包 Repository。

禁止 Page / Route 直接执行 SQL。

---

# 45. 新模块结构

建议新增：

```text
src/modules/market/
  providers/
    types.ts
    redfox-provider.ts

  components/

  repository.ts
  service.ts
  normalization.ts
  ranking.ts
  scoring.ts
  types.ts

src/modules/ideas/
  components/
  repository.ts
  service.ts
  types.ts

src/modules/analytics/
  components/
  repository.ts
  aggregation.ts
  summary-service.ts
  types.ts

src/modules/automations/
  repository.ts
  scheduler.ts
  service.ts
  types.ts

src/modules/skills/
  registry.ts
  types.ts

src/modules/agent/
  actions/
  registry.ts
  orchestrator.ts
  types.ts

src/modules/compliance/
  checkers/
  service.ts
  types.ts
```

---

# 46. API 规划

## Market

```text
GET  /api/market/hot
GET  /api/market/search
GET  /api/market/trends

GET  /api/market/items/:id

POST /api/market/items/:id/refresh

GET  /api/market/accounts
POST /api/market/accounts
GET  /api/market/accounts/:id
POST /api/market/accounts/:id/refresh
```

---

## Ideas

```text
GET    /api/ideas
POST   /api/ideas

GET    /api/ideas/:id
PATCH  /api/ideas/:id
DELETE /api/ideas/:id

POST /api/ideas/:id/favorite
POST /api/ideas/:id/feedback
POST /api/ideas/:id/create-project
```

---

## Dashboard

```text
GET  /api/dashboard/overview
GET  /api/dashboard/summary

POST /api/dashboard/summary

POST /api/dashboard/actions/:id
```

---

## Analytics

```text
GET /api/analytics/content
GET /api/analytics/topics
GET /api/analytics/platforms
GET /api/analytics/business
```

---

## Skills

```text
GET   /api/skills
PATCH /api/skills/:id
```

---

## Agent

```text
POST /api/agent/chat
GET  /api/agent/runs/:id
```

---

## Automations

```text
GET    /api/automations
POST   /api/automations
PATCH  /api/automations/:id
DELETE /api/automations/:id

POST /api/automations/:id/run
```

---

# 47. RedFox 配置

新增：

```env
REDFOX_API_KEY=
```

以后：

```env
MARKET_PROVIDER=redfox
```

---

# 47.1 API Key 原则

API Key：

- 仅服务端读取；
- 不返回前端；
- 不进入日志；
- 不进入 Git；
- 不进入 AI Prompt；
- 不写入 Provider Raw Payload。

---

# 48. Provider Observability

每次 API 请求记录最小必要信息：

```text
provider
endpoint
startedAt
finishedAt
success
cacheHit
itemCount
costEstimate
errorCode
```

不得保存：

> API Key。

---

# 49. UI 设计原则

## 49.1 不复制 Inspira UI

保留 Content Factory 当前：

```text
深绿
米金
白底
企业感
```

整体品牌视觉。

---

# 49.2 借鉴 Inspira 的是“信息密度”

重点学习：

```text
Dashboard 模块化
卡片信息层级
数据来源标签
状态标签
快速操作
趋势标签
Tab结构
```

---

# 49.3 页面视觉目标

从当前：

> SaaS 工具页面

升级为：

> 企业运营驾驶舱。

---

# 50. AppShell 重构

当前 `app-shell.tsx` 应改为支持：

```ts
type NavSection = {
  label?: string;
  items: NavItem[];
};
```

例如：

```ts
const navSections = [
  {
    label: "内容增长",
    items: [
      { label: "首页", href: "/" },
      { label: "市场雷达", href: "/radar" },
      { label: "灵感与选题", href: "/ideas" },
    ],
  },
  {
    label: "内容生产",
    items: [
      { label: "内容工厂", href: "/create" },
      { label: "内容项目", href: "/projects" },
      { label: "内容库", href: "/articles" },
    ],
  },
];
```

---

# 51. Dashboard 首页代码重构

当前：

```text
src/app/page.tsx
src/modules/dashboard/server/summary.ts
```

应继续使用。

新增：

```text
src/modules/dashboard/server/overview.ts
src/modules/dashboard/server/operation-summary.ts
```

---

# 52. Dashboard 数据层

不要直接让 LLM 自己从所有内容找结论。

先由代码生成：

```ts
type DashboardOverview = {
  account;
  content;
  knowledge;
  market;
  ideas;
  issues;
  business;
};
```

LLM 只消费这个结构。

---

# 53. Existing Inspiration 兼容

现有：

```text
/api/inspirations
```

继续可用。

V2 新市场记录进入爆款库时：

```text
MarketItem
↓
normalize
↓
InspirationCaptureInput
↓
existing inspiration service
```

最大限度复用已有代码。

---

# 54. Existing Review 兼容

不重新做审核系统。

仅扩展：

```text
ReviewIssueCategory
deterministic checkers
```

保留：

```text
AI Review
+
Deterministic Review
```

---

# 55. Existing Content Project 兼容

不改变现有：

```text
ContentProject.id
ContentBrief
ChannelDraft
```

核心结构。

新增字段必须 optional。

保证旧 JSON 可以继续读取。

---

# 56. 市场到创作的完整数据链路

```text
RedFox
↓
MarketItem
↓
OpportunityScore
↓
IdeaRecord
↓
InspirationRecord（可选）
↓
ContentBrief
↓
ContentProject
↓
ChannelDraft
↓
ChannelReview
↓
Publication
↓
Analytics
```

---

# 57. AI 调用分层

## Layer 1：无 LLM

```text
数据标准化
去重
基本指标
缓存
基础评分
关键词统计
```

---

## Layer 2：小模型 / 低成本模型

```text
关键词扩展
内容分类
相关度初筛
标题类型
```

---

## Layer 3：高质量模型

```text
爆款拆解
Opportunity 深度判断
企业知识匹配
Content Brief
内容生成
运营总结
```

---

# 58. 成本控制

原则：

> 先数据筛选，再用 AI。

例如：

```text
300条市场数据
↓
数值筛选
100
↓
相关度筛选
40
↓
重点候选
20
↓
AI深度分析
5～10
```

禁止：

> 300条全部丢模型逐条深度分析。

---

# 59. 市场搜索默认漏斗

一个主题：

```text
Keyword Expansion
5～8个关键词
↓
每个平台拉取一定数量
↓
去重
↓
数值过滤
↓
相关度
↓
Opportunity
↓
Top20
```

---

# 60. Agent / Skill 权限边界

第一版 Skill 不能拥有：

```text
任意 Shell
任意文件写
任意代码执行
```

只允许注册好的内部 Action。

---

# 61. 安全与隐私

继续遵守 V1：

> 企业私有知识优先留在客户环境。

市场数据和企业知识必须逻辑隔离。

---

# 61.1 市场内容

可以存：

```text
公开标题
公开指标
公开链接
分析结果
```

不鼓励长期完整复制大量平台全文。

---

# 61.2 企业内容

遵循最小读取原则。

---

# 62. 非目标范围

V2 第一阶段不做：

- 多租户 SaaS；
- 完整 CRM；
- 自动微信加好友；
- 自动销售；
- 自动发所有平台；
- 大规模爬虫；
- MediaCrawler 商业集成；
- 自建反爬系统；
- 十个平台一次性全支持；
- 开放 Skill 市场；
- arbitrary code execution；
- 向量数据库重构；
- 全量知识复制；
- 复杂 RBAC；
- App；
- 桌面客户端。

---

# 63. P0 —— 产品骨架升级

目标：

> 不接大量新数据，也能让产品结构先变正确。

实施：

1. 重构 AppShell；
2. 主导航分组；
3. `/topics` 加入可见导航；
4. `/inspirations` 加入可见导航；
5. “当前账号 + 个人风格”UI合并为“账号与品牌”；
6. “草稿历史”改名“内容项目”；
7. 首页信息架构重构；
8. 预留市场机会区域；
9. 保留原有内容工厂。

验收：

> 用户第一次打开系统能够理解：
>
> 市场 → 选题 → 内容 → 发布 → 复盘。

---

# 64. P1 —— RedFox Market Provider

实现：

```text
MarketDataProvider
RedFoxProvider
MarketItem
MarketMetricSnapshot
Normalization
Provider Cache
Provider Call Log
SQLite
```

验收：

主题：

```text
企业AI获客
```

小红书和抖音：

- 单平台返回 ≥30 条有效内容；
- 标题、作者、时间、互动、URL 完整率 ≥80%；
- 无明显重复；
- API Key 不暴露；
- 缓存有效；
- Provider 可替换。

视频号完成真实验证后进入正式状态。

---

# 65. P2 —— 市场雷达

实现：

```text
热榜
主题搜索
低粉爆款
趋势
```

每条内容：

```text
查看
收藏
拆解
生成选题
开始创作
```

验收：

> 用户不再需要去平台手工找10篇文章，再复制进 Content Factory。

---

# 66. P3 —— 灵感与选题升级

实现：

```text
IdeaRecord
Idea Status
Favorite
Like
Dislike
Block
Source Evidence
Opportunity Score
```

打通：

```text
MarketItem
↓
Idea
↓
ContentProject
```

验收：

> 一个市场热点可以在3次以内点击进入内容创作。

---

# 67. P4 —— 运营驾驶舱

实现：

```text
运营总结
关键问题
本周行动
亮点
账号表现
问题分布
市场机会
知识健康度
```

验收：

用户打开首页能回答：

```text
现在怎样？
哪里不好？
哪里有机会？
今天干什么？
```

---

# 68. P5 —— 发布前检查

增加：

```text
违禁词
广告法
平台
事实
品牌
AI味
CTA
```

继续复用：

```text
ReviewIssue
apply
ignore
```

---

# 69. P6 —— 账号追踪 + 相对爆款

实现：

```text
TrackedAccount
AccountPost
MedianPerformance
RelativeScore
```

支持：

```text
低粉爆款
账号异常爆款
```

---

# 70. P7 —— Skill 中心

实现第一批内部能力注册。

重点：

> 可查看、可启停、可描述，不追求开放生态。

---

# 71. P8 —— Agent

接入业务 Action。

验收：

用户可以：

```text
找热点
↓
筛选题
↓
收藏
↓
创建内容
```

在 Agent 对话里真正形成系统资产。

---

# 72. P9 —— 自动任务

支持：

```text
每日热点
关键词监控
账号刷新
爆款发现
周报
下周选题
```

---

# 73. P10 —— 商业反馈闭环

内容发布后增加：

```text
私信
加微信
咨询
有效线索
商机
成交
收入
```

最终系统优化目标从：

> 阅读量最大

升级成：

> 商业结果最大。

---

# 74. 各阶段实施顺序

必须严格遵循：

```text
P0 信息架构
↓
P1 数据底座
↓
P2 市场雷达
↓
P3 灵感选题
↓
P4 驾驶舱
↓
P5 发布检查
↓
P6 账号追踪
↓
P7 Skill
↓
P8 Agent
↓
P9 自动化
↓
P10 商业闭环
```

禁止：

> 还没把 Market → Idea → Content 跑顺，就先花大量时间做 Agent。

---

# 75. V2 第一关键闭环

项目第一阶段最重要的验收不是页面数量。

必须跑通：

```text
输入：
企业AI获客

↓
RedFox 搜索

↓
找到真实市场内容

↓
选出一个高价值爆款

↓
AI解释为什么值得写

↓
结合企业知识

↓
形成一个选题

↓
进入 Content Brief

↓
公众号 + 小红书 + 朋友圈 + 视频脚本

↓
发布前检查

↓
人工确认

↓
发布

↓
记录表现
```

完整跑通才算 V2 核心成立。

---

# 76. V2 第二关键闭环

```text
发布内容
↓
录入表现
↓
Analytics
↓
发现问题
↓
运营总结
↓
本周行动
↓
执行
↓
下一周复盘
```

---

# 77. 真实使用测试

选择一个真实主题：

```text
企业AI获客
```

关键词：

```text
企业AI
AI获客
AI销售
AI营销
AI员工
AI私域
内容获客
老板用AI
企业智能体
AI降本增效
```

平台：

```text
小红书
抖音
视频号
```

---

# 78. 市场雷达验收指标

### 数据

- 单平台 ≥30 条可用；
- 核心字段完整度 ≥80%；
- 去重有效；
- 原始链接有效；
- 数据日期明确；
- Provider 状态明确。

### 相关性

Top20 中：

> 人工认为真正相关 ≥70%。

### 可用性

至少：

> Top5 能够给出真正值得继续研究的内容。

---

# 79. 机会评分验收

Top20 不允许全是：

> 超级大 V。

必须能够出现：

> 低粉高表现内容。

必须能区分：

```text
“很火但跟企业无关”
```

和：

```text
“热度略低但非常适合企业客户”
```

---

# 80. 内容生产验收

选择 5 个机会。

至少 3 个：

- 能找到企业内部资料；
- 形成有效 Brief；
- 能生成可继续修改的公众号；
- 能生成小红书；
- 不构成原文简单改写；
- 核心事实来自企业知识。

---

# 81. 首页验收

打开首页后随机询问真实用户：

### Q1

最近运营怎么样？

### Q2

主要问题是什么？

### Q3

最近应该写什么？

### Q4

下一步做什么？

如果用户需要自己翻 3 个页面才能回答，则首页失败。

---

# 82. 发布检查验收

准备：

```text
明显违禁词
夸大表达
无依据数字
过强CTA
AI腔
不适合平台的内容
```

系统必须识别大部分明显问题。

---

# 83. 回归测试

V2 不允许破坏当前：

```text
账号
知识
Brief
原创
爆款改写
四渠道
Review
Version
Publication
```

现有 Acceptance Test 必须继续运行。

---

# 84. 新测试建议

新增：

```text
market-provider.test
market-normalization.test
market-dedupe.test
market-cache.test
opportunity-score.test

idea-lifecycle.test
idea-to-content.test

dashboard-overview.test
operation-summary.test

compliance-review.test

tracked-account.test
relative-score.test
```

---

# 85. 技术债务控制

禁止出现新的：

```text
70000行级 UI 单文件
```

页面应继续使用：

```text
src/modules/{domain}/components
```

拆分。

---

# 86. 目录所有权原则

每个 Domain：

```text
types
repository
service
components
API
tests
```

页面层主要做：

> composition。

---

# 87. Feature Flag

新能力建议支持 Feature Flag：

```env
FEATURE_MARKET_RADAR=true
FEATURE_IDEA_CENTER=true
FEATURE_OPERATION_SUMMARY=true
FEATURE_SKILL_CENTER=false
FEATURE_AGENT=false
FEATURE_AUTOMATIONS=false
```

避免一次升级把线上版本搞坏。

---

# 88. 页面空状态

每一个新页面必须设计空状态。

例如市场雷达未配置：

> 尚未配置市场数据源。

而不是：

> API Error。

---

# 89. Provider 降级

RedFox 请求失败：

```text
缓存存在
→ 展示缓存 + 标记更新时间

缓存不存在
→ 显示暂无最新数据

绝不伪造数据
```

---

# 90. 数据新鲜度

UI 统一展示：

```text
刚刚
3小时前
昨天
3天前
```

同时允许查看：

```text
精确 capturedAt
```

---

# 91. 业务状态颜色

统一：

```text
绿色：正常/增长/完成
黄色：建议关注
红色：风险/下降
灰色：暂无数据
蓝色：信息
紫色：AI
```

延续 Content Factory 现有主视觉。

---

# 92. 首页最终理想状态示例

用户打开：

---

## 本周内容增长

**总体判断**

公众号保持稳定，但小红书更新频率明显不足。最近 7 天“AI员工”和“AI销售”热度持续上涨，企业知识库中已有多份相关案例，可立即转化为内容。

### 关键问题

1. 案例型内容只占 12%
2. 小红书 7 天仅更新 1 篇
3. 近期内容偏产品介绍，用户问题覆盖不足

### 本周行动

- [ ] 输出 2 篇 AI 员工真实案例
- [ ] 跟进“AI销售”上涨话题
- [ ] 把一篇公众号拆成 3 条小红书

### 亮点

上周《老板到底需要几个AI员工？》互动率高于近30天平均值 62%。

---

## 市场机会

```text
AI员工          92
AI销售          88
超级个体        79
内容获客        76
```

---

## 企业资产

```text
产品        █████████ 90
案例        ████      42
FAQ         ██████    61
老板观点    ███       28
```

---

这才是 V2 首页应该给用户的体验。

---

# 93. 与 Inspira 的功能映射

| Inspira | Content Factory V2 |
|---|---|
| 运营总览 | 企业内容增长驾驶舱 |
| 问题分析 | 内容问题 + 企业资产问题 + 商业问题 |
| 账号概览 | 多平台账号运营概览 |
| 热榜 | 市场雷达 / 热榜 |
| 热词 | 市场机会 |
| 灵感搜索 | 主题搜索 |
| 灵感库 | 灵感与选题 |
| 灵感状态 | Idea 生命周期 |
| 账号追踪 | 对标账号 |
| 知识库 | 企业知识资产 |
| AI创作 | Content Factory |
| 违禁词 | 发布前检查 |
| Agent | AI员工 |
| Skill | Skill中心 |
| Cron | 自动任务 |
| 数据总结 | 运营复盘 |
| 内容指标 | 内容指标 + 商业线索 |

---

# 94. Content Factory 独有优势

V2 必须继续强化而不能被 Inspira 同质化的能力：

### 1. 企业知识

不仅是创作者自己的笔记。

### 2. 飞书

更适合企业真实环境。

### 3. Content Brief

保证多渠道内容共享事实和主张。

### 4. Citation

内容事实有来源。

### 5. Positioning

真正知道企业是谁、卖什么、服务谁。

### 6. Style Profile

不是所有企业输出相同 AI 风格。

### 7. Review / Apply / Ignore

生成以后仍然有质量控制。

### 8. Business Feedback

最后关心的是：

> 内容有没有带来客户。

---

# 95. V2 最终产品定义

Content Factory V2 不应该成为：

> 另一个灵感熔炉。

也不应该成为：

> 一个更复杂的 AI 写作工具。

最终产品应该是：

> **围绕企业线上获客，把市场情报、企业知识、内容生产和商业复盘连在一起的 AI 内容增长系统。**

---

# 96. V2 最终一句话

> **市场找机会，企业找证据，AI做内容，数据做复盘。**

---

# 97. Codex 开发总指令

Codex 开始 V2 开发时必须遵守以下原则：

1. 先阅读当前 `README.md`；
2. 阅读 `AI-Growth-OS-Spec-v1.0.md`；
3. 本 Spec 作为 V2 新增功能的最高规格依据；
4. 不删除 V1 已实现能力；
5. 所有 Schema 变更保持向后兼容；
6. 不一次性迁移全部 JSON；
7. Market 模块优先 SQLite；
8. RedFox 必须封装 Provider；
9. API Key 不进入前端；
10. 不复制 Inspira 源码；
11. 不像素级复制 Inspira UI；
12. 借鉴其 Dashboard、Hotlist、Inspiration、Skill、Agent、Cron 的产品思想；
13. 第一核心闭环必须是 Market → Idea → Content；
14. Agent 和 Automation 不得早于核心闭环；
15. 所有新功能必须有 Acceptance Test；
16. 当前 `npm run test:acceptance` 必须持续通过；
17. 不为了“架构漂亮”进行与业务无关的大规模重构；
18. 每个 Phase 完成后先真实使用再进入下一阶段。

---

# 98. 第一轮开发任务建议

第一轮只实施：

```text
TASK-01
重构 AppShell 分组导航

TASK-02
当前账号 + 个人风格合并为账号与品牌入口

TASK-03
/topics 和 /inspirations 正式进入导航

TASK-04
建立 market module 空骨架

TASK-05
引入 SQLite infrastructure

TASK-06
实现 MarketDataProvider

TASK-07
实现 RedFoxProvider

TASK-08
完成小红书主题搜索

TASK-09
完成抖音主题搜索

TASK-10
完成标准化 + 去重 + 缓存

TASK-11
实现 /radar/search 页面

TASK-12
MarketItem 一键进入 Inspiration

TASK-13
Inspiration 一键形成 Idea

TASK-14
Idea 一键进入现有 /create

TASK-15
回归全部 V1 Acceptance
```

完成以上 15 项后：

> 暂停继续加功能。

直接用：

```text
企业AI获客
```

跑真实测试。

---

# 99. 第二轮开发触发条件

只有第一轮真实测试满足：

- 数据质量可接受；
- 搜索结果相关；
- 爆款判断有价值；
- 从市场到创作顺畅；
- Content Factory 生成仍然稳定；

才进入：

```text
热榜
趋势
Opportunity Score
Dashboard
```

---

# 100. V2 成功标准

V2 成功不是：

> 页面越来越多。

而是用户能够越来越少地思考：

> “我今天到底该写什么？”

系统应该逐渐做到：

> **知道企业是谁，知道市场现在关心什么，知道企业有哪些真实素材，也知道过去什么内容真正带来了结果，然后告诉企业下一篇最值得写什么。**

这就是 Content Factory V2 / AI Growth OS 应该达到的最终方向。

---

# 附录 A：V2 建议模块关系

```text
positioning ─────┐
style-profile ───┤
knowledge ───────┤
                 │
market ─→ ideas ─┼→ content ─→ reviews ─→ drafts
                 │                    │
inspirations ────┘                    ↓
                                  publication
                                       ↓
                                   analytics
                                       ↓
                                   dashboard

skills ───────────────────────────────┐
agent ────────────────────────────────┼→ 调用各 Domain Service
automations ──────────────────────────┘
```

---

# 附录 B：第一版不要删除的现有目录

```text
src/modules/content
src/modules/dashboard
src/modules/drafts
src/modules/inspirations
src/modules/integrations
src/modules/knowledge
src/modules/positioning
src/modules/reviews
src/modules/style-profile
src/modules/topics
```

V2 主要做：

```text
新增：
market
ideas
analytics
automations
skills
agent
compliance
```

然后逐步让：

```text
topics
```

的职责被：

```text
ideas + market
```

吸收。

---

# 附录 C：架构决策摘要

```text
V1 内容核心：
保留

Next.js：
保留

模块化 src/modules：
保留

飞书：
保留并强化

本地知识：
保留

JSON：
现有业务继续使用

SQLite：
新市场数据使用

RedFox：
采用

RedFox API：
Provider 封装

Inspira：
产品参考，不作为运行依赖

市场搜索：
P0/P1

热榜：
P1

Opportunity Score：
P1

Dashboard：
P1

发布检查：
P1

账号追踪：
P2

Skill：
P2

Agent：
P2

Automation：
P2

CRM：
暂不做

多租户：
暂不做
```

---

# 附录 D：产品升级核心判断

V1：

```text
我有什么
↓
我能写什么
```

V2：

```text
市场需要什么
+
我有什么
+
过去什么有效
↓
我现在最应该写什么
↓
怎么写
↓
有没有带来客户
```

这是本次升级最重要的产品变化。