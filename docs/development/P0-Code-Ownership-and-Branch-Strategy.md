# P0 代码归属与分支策略

> 状态：PR0 开发基线  
> 适用范围：PR1–PR9  
> 上位文档：`docs/prd/Content-Factory-MVP-PRD-v0.1.md` 和 `docs/specs/AI-Growth-OS-Spec-v1.0.md`

---

# 1. 目的

后续每个功能使用独立分支和 PR，但不应该同时在页面、AI 逻辑和本地存储的共享大文件中互相穿插。

本文档固定：

- 每个功能的代码位置；
- 页面、API、业务逻辑和基础设施的边界；
- 共享文件的修改权；
- 分支创建、合并和冲突处理顺序。

---

# 2. 核心原则

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
