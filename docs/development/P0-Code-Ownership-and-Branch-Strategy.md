# 内容工厂代码归属与分支策略

> 状态：2026-09-24 当前开发基线
> 适用范围：Vercel + Supabase 真实验收与视频生产路线
> 上位文档：`docs/prd/Content-Factory-MVP-PRD-v0.1.md` 和 `docs/specs/AI-Growth-OS-Spec-v1.0.md`
> 视频路线：`docs/roadmap/Content-Factory-Video-Production-Roadmap-2026-09-22.md`

---

# 1. 目的

后续每个功能使用独立分支和 PR，但不应该同时在页面、AI 逻辑和本地存储的共享大文件中互相穿插。

本文档固定：

- 每个功能的代码位置；
- 页面、API、业务逻辑和基础设施的边界；
- 共享文件的修改权；
- 分支创建、合并和冲突处理顺序。

PR1–PR9 已是历史基线。下方旧分工保留用于理解已有模块；新工作的依赖、所有权和合并顺序以本文第 2 节为准。

---

# 2. 2026-09-24 当前 PR 边界与依赖

| 任务 | 建议分支 | 主要所有权 | 明确不做 | 依赖 |
|---|---|---|---|---|
| DEPLOY-REAL-USE | 实施记录，必要时单独 `fix/deployment-*` | Vercel/Supabase 配置、部署验收和回归证据 | 不顺手开发视频 | `main@8cf696b` |
| PR-SYNC | `docs/video-roadmap-sync` | README、TODO、PRD、Spec、SBD、部署、隐私、验收、本文档 | 不改业务代码和 migration | 当前基线 |
| VIDEO-ENGINE-1 | 已完成：`feat/video-engine-hardening` | 任务契约、素材标签、TTS、编排、Remotion/FFmpeg、技术验证 | 不改内容工厂 | PR-SYNC |
| ASSET-CATALOG-0 | 当前文档分支 | `docs/roadmap/Video-Asset-Library-Catalog-v0.1.md`、shared/workspace 范围、OSS key、元数据 | 不上传或迁移媒体 | VIDEO-ENGINE-1 |
| PR-MEDIA-1 | `feat/video-media-library` | `src/modules/media/**`、媒体 API、Postgres migration、OSS 签名/分片上传、shared/workspace 隔离、素材手册生成和测试 | 不引入渲染 Worker，不改造 Supabase 图文资产桶 | DEPLOY-REAL-USE、ASSET-CATALOG-0 |
| PR-VIDEO-1 | `feat/video-domain-contracts` | `src/modules/plans/types.ts`、`src/modules/video/**`、视频数据 migration/存储、契约测试 | 不连真实 Worker | PR-SYNC；在 PR-MEDIA-1 后合并 |
| PR-VIDEO-2 | `feat/video-worker-integration` | Worker client、任务 API、幂等/重试/取消/回调、成本记录 | 不做复杂编辑器 | VIDEO-ENGINE-1、PR-MEDIA-1、PR-VIDEO-1 |
| PR-VIDEO-3 | `feat/video-review-mobile` | 成片审核 UI、素材替换、手机预览/下载、端到端验收 | 不做时间线编辑器 | PR-VIDEO-2 |
| PR-REAL-USE | `test/video-real-use` 或独立验收任务 | 固定样本、真实业务记录、成本/耗时/修改/发布证据 | 不用模拟数据宣布业务通过 | PR-VIDEO-3 |

当前 `DEPLOY-REAL-USE` 与视频线可并行。`VIDEO-ENGINE-1` 已完成本地验收，`ASSET-CATALOG-0` 在当前文档分支收口；主项目中的视频合并顺序固定为 `PR-MEDIA-1 → PR-VIDEO-1 → PR-VIDEO-2 → PR-VIDEO-3 → PR-REAL-USE`。`PR-VIDEO-2` 同时依赖 VIDEO-ENGINE-1、PR-MEDIA-1 和 PR-VIDEO-1。

共享文件规则：

- `src/modules/plans/types.ts` 只由 PR-VIDEO-1 增加交付类型和兼容默认值；
- Supabase migration 每个 PR 新建时间戳文件，不改写已部署 migration；
- `src/lib/config.ts`、middleware 和环境变量说明如需修改，由当前集成 PR 单独提交，不与 UI 大面积交叉；
- 视频引擎不复制到 Next.js 仓库；通过已版本化的 Worker 契约集成；
- 每个 PR 都需先同步最新 `main`，只添加自己范围文件，合并前执行范围内测试、`git diff --check` 和实际浏览器路径。

---

# 3. 历史 PR1–PR9 核心原则

1. 所有功能分支从最新 `main` 创建；
2. PR1–PR9 按审计报告顺序线性合并；
3. `src/app/**` 只做路由、参数读取和页面组装；
4. `src/app/api/**` 只做请求解析、校验、调用模块和返回响应；
5. 业务类型、Prompt、服务、存储适配和功能组件放在 `src/modules/<module>/**`；
6. 只有真正被两个以上模块使用的基础能力才能放在 `src/lib/**`；
7. 不在新代码中继续扩展现有的 `src/lib/ai.ts` 和 `src/lib/store.ts` 大文件；
8. 一个 PR 不顺手重构其他模块；
9. 需要改共享文件时，与功能模块改动分开提交；
10. 两个分支不同时修改同一个共享集成文件。

---

# 3. 固定目录

```text
src/
├── app/
│   ├── page.tsx                       # 默认创作页，只组装模块
│   ├── positioning/                  # 当前账号路由
│   ├── knowledge/                    # 知识库路由
│   ├── drafts/                       # 草稿历史路由
│   └── api/                          # 薄 Route Handlers
├── components/
│   ├── app-shell.tsx                 # 全局导航与壳
│   └── ui/                           # 真正通用的原子 UI
├── modules/
│   ├── positioning/                  # 采集负载、定位、AccountContext
│   ├── knowledge/                    # 本地目录、飞书、检索和证据选择
│   ├── topics/                       # 创作页内的最小选题能力
│   ├── content/                      # ContentProject、ContentBrief、四渠道
│   ├── reviews/                      # 事实、风格和平台审核
│   ├── drafts/                       # 草稿读取、修改版本和导出
│   └── integrations/
│       └── feishu/                   # 飞书客户端和映射
├── lib/
│   ├── ai/                           # Gateway 传输层，不放业务 Prompt
│   ├── local-store/                  # JSON 原子读写与通用存储基础
│   └── validation/                   # 跨模块请求校验工具
├── prompts/                               # 只放跨模块公共 Prompt 片段
├── tests/                                 # 集成与主流程测试
└── types/                                 # 只放跨模块公共类型

extensions/
└── contentfactory-capture/                 # 账号页主动采集插件
```

模块内部按需使用：

```text
src/modules/<module>/
├── types.ts
├── service.ts
├── repository.ts          # 只有需要持久化的模块才创建
├── prompts.ts             # 只有该模块的 Prompt
├── components/            # 只有该模块的 UI
└── index.ts               # 对外公开的最小 API
```

不要为了补齐结构而创建空文件；只在功能需要时创建。

---

# 4. P0 稳定路由和 API

## 4.1 页面

| 路由 | 用途 | 代码所有者 |
|---|---|---|
| `/` | 轻量内容经营首页 | `modules/dashboard` 负责聚合，`app/page.tsx` 只组装 |
| `/create` | 内容创作 | `modules/content` 负责主体，`app/create/page.tsx` 只组装 |
| `/positioning` | 当前唯一账号 | `modules/positioning` |
| `/knowledge` | 本地文件夹和飞书知识 | `modules/knowledge` |
| `/drafts` | 草稿历史 | `modules/drafts` |
| `/drafts/[id]` | 草稿详情和继续编辑 | `modules/drafts` |

`/topics`、`/inspirations`、`/articles` 和旧数据工作台不是 P0 稳定路由，可保留兼容或重定向，但不作为新模块依赖。

## 4.2 API

| API | 所有模块 |
|---|---|
| `GET /api/positioning/current` | `modules/positioning` |
| `POST /api/positioning/analyze` | `modules/positioning` |
| `PATCH /api/positioning/current` | `modules/positioning` |
| `POST /api/capture/account` | `modules/positioning` + Chrome 插件 |
| `GET /api/knowledge-sources` | `modules/knowledge` |
| `POST /api/knowledge/search` | `modules/knowledge` |
| `/api/integrations/feishu/**` | `modules/integrations/feishu` |
| `POST /api/topics/suggest` | `modules/topics` |
| `POST /api/content/brief` | `modules/content` |
| `POST /api/content/generate` | `modules/content` |
| `POST /api/content/generate/[channel]` | `modules/content` |
| `/api/content-drafts/**` | `modules/drafts`，审核端点调用 `modules/reviews` |

---

# 5. PR 与代码所有权

| PR | 主要代码位置 | 允许修改的共享文件 |
|---|---|---|
| PR1 产品外壳 | `src/app/page.tsx`、`src/components/app-shell.tsx`、P0 路由骨架 | 只有 PR1 负责导航和顶层路由 |
| PR2 账号上下文 | `src/modules/positioning/**`、定位 API | 可一次性抽出 `src/lib/ai/client.ts` 和 `src/lib/local-store/**` |
| PR3 知识源 | `src/modules/knowledge/**`、`src/modules/integrations/feishu/**`、知识 API | 不改账号和内容生成内部逻辑 |
| PR4 内容简报 | `src/modules/topics/**`、`src/modules/content/**` 的 brief 部分 | 可在 `app/page.tsx` 增加一次组装入口 |
| PR5 四渠道 | `src/modules/content/**` 的 channel 部分 | 不修改知识和账号模块 |
| PR6 审核编辑 | `src/modules/reviews/**`、`modules/content/components/**` | 不修改 Gateway 传输层 |
| PR7 草稿历史 | `src/modules/drafts/**`、`src/app/drafts/**`、草稿 API | 不修改生成 Prompt |
| PR8 账号插件 | `extensions/contentfactory-capture/**`、`/api/capture/account` | 通过已稳定的 positioning service 写入，不直接改存储文件 |
| PR9 验收 | `src/tests/**`、README、验收文档 | 只修复测试暴露的 P0 问题 |

---

# 6. 共享文件规则

以下是高冲突文件：

```text
src/app/page.tsx
src/components/app-shell.tsx
src/lib/ai.ts
src/lib/store.ts
package.json
package-lock.json
```

执行规则：

- `src/app/page.tsx` 在 PR1 建立稳定组装壳，后续只导入模块对外组件；
- `src/components/app-shell.tsx` 在 PR1 收缩后冻结，其他功能 PR 不修改导航；
- `src/lib/ai.ts` 在 PR2 抽出 Gateway 传输后视为 legacy，新 Prompt 放在各模块；
- `src/lib/store.ts` 在 PR2 抽出原子本地存储后视为 legacy，新数据访问由模块 repository 负责；
- 依赖变化集中在需要该依赖的第一个 PR，不单独进行“顺手升级”；
- 并行开发时，功能分支先只新增模块内文件，等前置 PR 合并后 rebase，再做路由集成。

---

# 7. 分支流程

```text
main
  └── refactor/p0-product-shell
        → merge
main
  └── feat/p0-account-context
        → merge
main
  └── feat/p0-knowledge-sources
        → merge
...
```

标准操作：

1. 上一个 PR 合并；
2. 本地切回 `main` 并拉取最新代码；
3. 从最新 `main` 创建下一个分支；
4. 只修改所有权表允许的目录；
5. lint、build 和功能验收通过后提交 PR；
6. PR 中列出“本次未改”的相邻模块，防止范围溢出。

如必须并行开发，只并行模块内部代码，不并行修改共享入口。
