# 内容工厂视频生产链路与实施路线

> 状态：下一阶段产品与技术决策基线，尚未进入主项目功能实现
> 更新日期：2026-09-24
> 代码基线：`main@8cf696b`
> 参考 PoC：`/Users/renxiaokang/connor/ziyong/视频剪辑调研/video-engine`
> 上位文档：PRD、SBD、Spec
> 素材目录：`Video-Asset-Library-Catalog-v0.1.md`
> 执行顺序：`todo.md`

## 1. 结论

内容工厂的文字与图文生产闭环已经成立。下一阶段不是继续增加更多独立工具，而是把短视频从“脚本”延伸为第二种主要可发布产物：

```text
决定发什么
→ 生成图文或视频
→ AI 审核
→ 人工确认
→ 发布与回填
→ 调整下一周计划
```

视频剪辑 PoC 已经证明以下路径可行：本地素材扫描、结构化分镜、素材匹配、TTS、字幕、BGM、Remotion/FFmpeg 渲染和 1080×1920 MP4 输出。独立视频引擎已补齐非交互任务契约、幂等、稳定错误、人工素材标签、成片技术校验和固定样本回归；合香珠概念样片已产出可播放的 H.264 + AAC 竖屏成片。

这不等于视频能力已经可以直接合入内容工厂。引擎仍是独立进程和本地文件系统架构，还没有 OSS 通用素材库、客户私有素材隔离、云端任务队列、Web 端调整和成片审核。当前应将它定义为：

> **独立引擎和概念样片已验证，下一个核心不是继续为单店写死素材，而是先建立可跨行业复用、权利清晰、可被引擎检索的 OSS 素材库。**

### 1.1 通用化核心决策

1. 视频和音乐原文件统一放入私有 OSS，不再依赖某台开发机的 `assets/` 目录；
2. 素材分成平台通用库和 workspace 私有库，通用氛围镜头可复用，真实门店、产品、员工和案例不串库；
3. 每个原文件拆出可剪时间段，标注行业、场景、镜头角色、景别、情绪、适用/禁用场景和建议时长；
4. 数据库或版本化 manifest 是权威元数据，Markdown 素材手册由它生成，不手工维护两套真相；
5. 合香珠、咖啡厅和家装店作为首批反向验证场景，检查素材标签是否真正通用。

## 2. 产品总流程

```text
企业资料 / 历史内容 / 账号数据
                ↓
          账号定位与风格
                ↓
       内容策略 + 30 天计划
                ↓
┌──────────────────────────────────┐
│ 企业知识 │ 客户痛点 │ 市场信号 │ 爆款参考 │ 历史效果 │
└──────────────────────────────────┘
                ↓
             今日选题
                ↓
             内容简报
                ↓
       选择本次可发布产物
          ↙             ↘
       图文               视频
        ↓                 ↓
   文案 + 配图       短视频脚本
                          ↓
                   视频制作方案
                          ↓
          通用素材库 + 当前客户私有素材
                          ↓
                  可解释匹配与人工调整
                          ↓
                    异步渲染成片
          ↘             ↙
              AI 审查
                 ↓
              人工确认
                 ↓
            复制 / 下载发布
                 ↓
          数据回填 + 用户反馈
                 ↓
              每周复盘
```

爆款不是每日主流程中的必经步骤。它与企业知识、客户痛点、市场信号和历史效果一样，是持续补充的情报输入。用户日常只需要看到“今天建议发什么、为什么、生成图文还是视频”。

## 3. 产品对象边界

### 3.1 保留 `short_video_script`

`short_video_script` 继续作为 `ChannelDraft`，不能直接改名为 `short_video`。脚本是事实、口吻、平台表达和人工确认的载体，也是视频制作的稳定输入。

内容项目增加独立的视频制作聚合：

```text
ContentProject
├── ChannelDraft
│   └── short_video_script
└── VideoProduction
    ├── productionPlan
    ├── assetMatches
    ├── renderJob
    ├── output
    └── review
```

以后真人拍摄、企业自有素材剪辑、数字人或生成式视频，都可以复用已确认脚本，而不需要破坏现有内容渠道模型。

### 3.2 内容计划指定“产物”，不是“处理步骤”

`ContentPlan.primaryChannel` 继续表示计划主渠道。计划项新增可选字段：

```ts
type ContentDeliverable =
  | "wechat_article"
  | "xiaohongshu_note"
  | "xiaohongshu_cards"
  | "moments_post"
  | "short_video_script"
  | "short_video";

type ContentPlanItem = {
  // existing fields...
  targetDeliverable?: ContentDeliverable;
};
```

旧计划没有该字段时，回退到 `primaryChannel`；现有 `short_video_script` 仍表示只交付脚本，只有明确选择 `short_video` 才进入成片生产。第一版不增加 `targetChannels[]`，避免过早引入矩阵发布。

### 3.3 视频制作核心对象

```ts
type VideoProductionPlan = {
  id: string;
  contentProjectId: string;
  scriptVersionId: string;
  template: "local_business_v1";
  aspectRatio: "9:16";
  targetDurationSeconds: number;
  segments: Array<{
    id: string;
    narration: string;
    visualQuery: string;
    tags: string[];
    preferredShotType?: "wide" | "medium" | "closeup" | "macro";
  }>;
  status: "draft" | "confirmed";
  createdAt: string;
  confirmedAt?: string;
};

type MediaAsset = {
  id: string;
  scope: "shared" | "workspace";
  workspaceId?: string;
  storageProvider: "oss";
  storageKey: string;
  kind: "video" | "image" | "audio";
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  checksum: string;
  sourceType: "customer_owned" | "platform_created" | "licensed_library";
  rightsStatus: "approved" | "restricted" | "unknown" | "expired";
  rightsNote?: string;
  rightsExpiresAt?: string;
  reviewStatus: "draft" | "active" | "disabled";
  createdAt: string;
};

type MediaClip = {
  id: string;
  assetId: string;
  startSec: number;
  endSec: number;
  role: "hook" | "establishing" | "process" | "detail" | "proof" | "cta" | "transition";
  industries: Array<"common" | "fragrance" | "cafe" | "home_improvement" | string>;
  scenes: string[];
  tags: string[];
  shotType?: "wide" | "medium" | "closeup" | "macro";
  orientation: "vertical" | "horizontal" | "square";
  mood?: string[];
  useCases: string[];
  avoidCases: string[];
  suggestedDurationSec?: [number, number];
  qualityScore?: number;
};

type VideoRenderJob = {
  id: string;
  videoProductionId: string;
  idempotencyKey: string;
  workerVersion: string;
  status:
    | "queued"
    | "preparing"
    | "rendering"
    | "validating"
    | "completed"
    | "failed"
    | "cancelled";
  attempt: number;
  progress?: number;
  errorCode?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

type VideoOutput = {
  storagePath: string;
  thumbnailPath?: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  checksum: string;
  createdAt: string;
};

type VideoReview = {
  content: ReviewIssue[];
  visual: ReviewIssue[];
  alignment: ReviewIssue[];
  rights: ReviewIssue[];
  platform: ReviewIssue[];
  technical: ReviewIssue[];
  technicalChecks: {
    decodable: boolean;
    nonBlack: boolean;
    hasAudio: boolean;
    durationMatches: boolean;
    dimensionsMatch: boolean;
  };
  status: "pending" | "passed" | "needs_changes";
  humanConfirmedAt?: string;
};
```

Worker 内部可以继续使用 PoC 的 `EditPlan`，但 `EditPlan` 是渲染执行协议，不应成为内容工厂的顶层业务对象。

## 4. 系统边界

```text
Content Factory（Vercel）
负责：账号、计划、知识、简报、脚本、制作方案、素材选择、任务状态、审核、人工确认
                │
                │ 创建任务 / 查询状态
                ↓
Video Worker（独立进程或容器）
负责：素材下载、TTS、EditPlan、Remotion、FFmpeg、技术校验、上传成片
                │
        ┌────────┴────────┐
        ↓                 ↓
Supabase Postgres       私有 OSS
业务/任务/素材索引     原素材/代理文件/音频/成片
```

不采用“Next.js API 同步运行 FFmpeg 并让用户等待”的主方案。即使 [Vercel Functions 已可提供更长的运行时间](https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes)，视频任务仍需要可靠队列、幂等、重试、进度、取消、CPU 隔离和部署期间不丢任务，这些要求比单次函数时限更重要。

第一阶段 Worker 可以是一台受控的 Docker 服务，不引入复杂编排平台。内容工厂通过服务端凭证创建任务；Worker 通过轮询领取或受保护的内部接口接收任务。所有任务必须带 `idempotencyKey`，重复请求不得产生多个收费成片。

## 5. OSS 通用素材库

当前 Supabase migration 中的 `content-factory-assets` 限制为 20 MB，且 MIME 只包含图片和文本。它继续服务图文产物，不扩张成视频仓库。

视频阶段新增独立私有 OSS 媒体面：

```text
content-factory-video/
├── shared/<asset-id>/...                     # 平台通用素材
├── workspaces/<workspace-id>/<asset-id>/... # 客户私有素材
└── outputs/<workspace-id>/<production-id>/<job-id>/...
```

数据库记录 `MediaAsset` 和 `MediaClip`；OSS 只存放原文件、低码率预览、封面、音频波形和成片。素材匹配以可剪片段为单位，不把一条长视频当作一个不可解释的整体。

原则：

- 平台通用素材必须有可复核的来源与授权；客户私有素材只能在所属 workspace 命中；
- 浏览器使用分片或断点续传直接上传 OSS，不经 Vercel Function 中转大文件；
- bucket 保持私有，浏览器预览和 Worker 下载使用短时签名 URL；
- 默认不覆盖同一路径，通过 checksum 去重和校验完整性；
- `rightsStatus != approved` 或 `reviewStatus != active` 的素材不得自动进入成片；
- 客户删除素材时，同时处理引用关系、派生音频、成片和缩略图；
- 元数据是权威记录，给人阅读的素材手册由元数据生成。

完整分类、OSS key 约定、待入库素材和入库 SOP 见 `Video-Asset-Library-Catalog-v0.1.md`。

## 6. 视频任务链路

1. 用户从已确认的 `short_video_script` 点击“制作视频”；
2. 内容工厂根据脚本生成 `VideoProductionPlan`，用户可以确认分镜和目标时长；
3. 系统先硬过滤权利与 workspace，再从通用素材库和当前客户私有库匹配可剪片段，显示匹配原因、取材时间、授权状态和缺口，用户可替换；
4. 内容工厂保存制作方案和素材快照，创建 `queued` 任务并立即返回；
5. Worker 领取任务，通过签名 URL 下载素材，生成 TTS，构建 `EditPlan`；
6. Worker 用 Remotion/FFmpeg 渲染，执行黑屏、静音、分辨率、时长和文件完整性检查；
7. Worker 上传成片和缩略图，原子更新任务为 `completed`；失败则保存错误码和可重试性；
8. 内容工厂执行内容、画面匹配、版权、平台和技术审核；
9. 用户在手机端预览、调整或重试，人工确认后下载发布；
10. 发布链接与效果继续进入现有回填和周复盘。

## 7. PoC 复用边界

直接复用或演进：

- `Asset`、`Storyboard`、`EditPlan` 的字段含义；
- TTS Provider 抽象；
- 素材匹配提示词和景别约束；
- Remotion 竖屏模板、字幕、BGM 与 FFmpeg 输出；
- 成本与步骤耗时记录思路。

不能直接搬入内容工厂：

- 交互式 CLI、绝对本地路径和 `assets/` / `output/` 目录假设；
- 把全部素材一次性发给模型选择的方式；
- 没有服务鉴权、云端队列、取消和回调签名的任务入口；
- 本地 sidecar 标签和本地文件扫描不能代替 OSS 素材目录和 workspace 隔离。

黑屏/无音轨、素材路径、TTS 失败、空分镜、幂等和未知成本已在独立引擎硬化中处理。下一个风险中心是素材权利、可检索元数据、私有隔离和云端任务调度。

## 8. 固定实施顺序

### DEPLOY-REAL-USE：当前 Vercel + Supabase 真实上线

- 由实施者完成真实项目、workspace、域名和环境变量；
- 验证登录、跨设备数据、Production / Preview 隔离、备份恢复和 390 px 黄金路径；
- 不因为后续要做视频而推迟当前图文产品上线。

### PR-SYNC：文档与当前状态收口

- 对齐 README、PRD、SBD、Spec、TODO、部署、隐私、验收和分支策略；
- 明确 PoC 已验证与未验证部分；
- 不引入视频业务代码。

### VIDEO-ENGINE-1：独立引擎工程化（已完成本地验收）

- 已完成非交互式输入输出契约、幂等复用与冲突拦截；
- 已拦截空分镜、缺素材、静音、黑屏和失败仍标记完成；
- 已使用人工 sidecar 标签作为当前可解释兜底；
- 已建立固定夹具、成片技术检查、稳定错误码、幂等和 Dockerfile；
- 固定 1080×1920 回归 10/10 通过，合香珠概念样片验证真实 TTS、外部素材和成片校验；
- 容器构建仍需在安装 Docker 的环境完成一次验证。

### ASSET-CATALOG-0：通用素材分类与入库清单

- 冻结 shared / workspace 两层范围、OSS key 约定和 `MediaAsset` / `MediaClip` 元数据；
- 盘点现有视频和音乐，为每个可剪片段记录适用/禁用场景、建议时长和授权；
- 参考 demo 未确认二次使用授权前只做结构参考，不进 shared 库；
- 以合香珠、咖啡厅、家装店三个场景检查分类的通用性。

### PR-MEDIA-1：内容工厂媒体底座

- 建立独立私有 OSS 媒体面和服务端签名/访问策略；
- 建立 shared 通用库和 workspace 私有库的强隔离；
- 实现分片/断点续传、上传进度、checksum、代理片、缩略图和素材元数据；
- 实现可剪片段、行业/场景/用途标签、版权状态、删除和保留策略；
- 从结构化目录生成人工可读的素材手册；
- 暂不自动剪辑。

### PR-VIDEO-1：视频领域契约与计划混排

- 增加 `targetDeliverable`、`VideoProductionPlan`、`VideoProduction`、`VideoRenderJob`、`VideoOutput`；
- 保留 `short_video_script`；
- 建立 API、状态机、幂等键和旧计划兼容；
- 暂不调用真实 Worker。

### PR-VIDEO-2：Worker 接入与异步成片

- 从已确认脚本和制作方案创建任务；
- Worker 鉴权、领取、进度、重试、取消和回调；
- 成片与缩略图写入私有 OSS；
- 部署或 Worker 重启时任务不丢失、不重复收费。

### PR-VIDEO-3：视频审核、手机预览与人工确认

- 内容、画面、对齐、版权、平台、技术六类审核；
- 390 px 手机宽度完成预览、重试和下载；
- 任何脚本、分镜或素材变化后，人工确认自动失效；
- 保留人工发布，不做平台自动发布。

### PR-REAL-USE：贝尔咖啡 7～14 天真实验证

- 图文与视频混排执行；
- 记录单条视频人工介入时间、失败率、重试率和修改原因；
- 记录真实发布、数据反馈和客户能否独立完成第二条；
- 决定是否继续投入模板、视觉检索和规模化 Worker。

当前两条工作可并行：`DEPLOY-REAL-USE` 由实施者推进，视频线从已完成本地验收的 `VIDEO-ENGINE-1` 进入 `ASSET-CATALOG-0 → PR-MEDIA-1`。进入主项目视频代码后，合并顺序固定为 `PR-MEDIA-1 → PR-VIDEO-1 → PR-VIDEO-2 → PR-VIDEO-3 → PR-REAL-USE`。`PR-VIDEO-2` 必须等引擎、媒体库和领域契约全部通过。

## 9. 验收闸门

### 引擎闸门

- 同一固定夹具连续渲染 10 次，至少 9 次产生可播放、非黑屏、非静音的 MP4；
- 输出为 1080×1920、30 FPS，时长和制作方案误差有明确上限；
- 每个失败都有稳定错误码，失败任务不会出现 `completed` 输出；
- 同一幂等键重复请求只产生一个有效任务和一份最终输出；
- 未知成本显示 `unknown`，不记为 0。

### 素材库闸门

- shared 和 workspace 素材在查询、签名 URL、匹配和 Worker 下载四个环节均不串库；
- 每个可自动匹配的片段都有明确起止时间、适用/禁用场景和 `approved` 授权；
- 合香珠、咖啡厅、家装店都能获得可解释的候选素材，且不用通用画面伪装真实门店；
- 结构化目录变化后，人工可读手册可重新生成，不需要人工双写；
- 视频与音乐的授权证据、可用渠道和有效期可核对。

### 集成闸门

- 手机端可断点上传、查看进度、离开后恢复；
- Worker 或 Web 重启后任务状态和素材不丢失；
- 未登录、非本 workspace 和过期签名 URL 均不能读取媒体；
- 修改脚本、分镜或素材后旧审核与人工确认失效；
- 数据删除能够覆盖原素材、派生音频、成片、缩略图和任务记录。

### 业务闸门

- 客户能从“今天建议发什么”进入视频成片，不理解素材索引、TTS、Remotion 或 FFmpeg；
- 单条 15～30 秒视频人工操作时间目标为 3～5 分钟；
- 客户能独立完成第二条视频；
- 真实发布后记录播放、互动、线索、主观反馈和下一周调整；
- 未通过这些闸门前，不把自动成片加入标准付费交付承诺。

## 10. 明确后置

- 在线时间轴编辑器；
- AI 数字人和生成式视频；
- 对客户公开的素材市场、用户上传到 shared 库和自动抓取互联网视频；
- 自动发布、矩阵发布和平台账号托管；
- 多模板市场、复杂转场和专业调色；
- 长视频切片和大规模向量检索；
- 面向客户的积分、套餐和视频算力余额。

## 11. 进入 OSS 实施前待确认

1. 首发 OSS 供应商、region、bucket 和每月存储/流量预算；
2. 第一批通用素材的来源与可跨客户使用授权；
3. Worker 首发运行位置和预算上限；
4. 首发 TTS Provider、可商用授权和失败兜底；
5. 通用素材、客户私有素材、派生音频和成片的默认保留时长。

其他细节以真实视频生产数据决定，不在文档阶段提前建设。
