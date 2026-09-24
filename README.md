# Content Factory

This repository contains the runnable Content Factory V1 baseline for real-use and paid-delivery validation.

## Source of truth

- Product requirements: `docs/prd/Content-Factory-MVP-PRD-v0.1.md`
- Paid-pilot service blueprint: `docs/sbd/Content-Factory-Paid-Pilot-SBD-v1.0.md`
- Technical specification: `docs/specs/AI-Growth-OS-Spec-v1.0.md`
- Execution order: `todo.md`
- Paid-pilot architecture spike: `docs/spikes/Paid-Pilot-Architecture-and-Cost-Ledger-Spike-2026-09-19.md`
- Video production architecture and roadmap: `docs/roadmap/Content-Factory-Video-Production-Roadmap-2026-09-22.md`
- Video asset taxonomy, OSS layout, and catalog: `docs/roadmap/Video-Asset-Library-Catalog-v0.1.md`
- Historical code audit: `docs/audits/Content-Factory-MVP-Code-Audit-2026-07-20.md`
- Branch and code ownership: `docs/development/P0-Code-Ownership-and-Branch-Strategy.md`
- Paid-pilot deployment: `docs/deployment/Paid-Pilot-Deployment-Checklist.md`
- Privacy and data lifecycle: `docs/deployment/Privacy-and-Data-Lifecycle.md`

The implemented V1 direction, as of `main@8cf696b`, is:

- Web app, single-enterprise deployment.
- Customer-owned knowledge base first.
- Local Markdown/TXT folders first, with Feishu as the enterprise knowledge connector.
- Temporary local text upload as fallback.
- Omni/OpenAI-compatible AI gateway for generation.
- The hosted path uses Supabase Auth, one configured workspace per customer instance, Supabase Postgres-backed cloud state, and private Storage. Public registration, payments, and shared self-serve multi-tenancy remain out of scope.
- The local/Docker compatibility path keeps SQLite and atomic JSON stores under `CONTENT_FACTORY_DATA_DIR`.
- Current account state, confirmed briefs, plans, drafts, reviews, and market state use the cloud adapter when Supabase persistence is configured and local storage otherwise.
- Original creation and optional viral-rewrite creation share one brief and review flow.
- Xiaohongshu supports one generated cover plus editable text-based content cards.
- Content library supports manual publication links, real metrics, leads, qualitative feedback, and evidence-backed weekly review; automatic publishing is not included.
- The viral-content library stores structured source identity and engagement snapshots, deduplicates repeat imports, and keeps legacy records readable.
- A versioned 30-day `ContentPlan` stores 3–5 pillars, 30 ideas, weekly priorities, evidence, human locks, and links to content projects.
- Short-video output currently ends at a `short_video_script`. Automatic MP4 production is a validated external PoC and a planned second deliverable path, not an implemented Content Factory feature.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CONTENT_FACTORY_WORKSPACE_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

FEISHU_APP_ID=
FEISHU_APP_SECRET=

AI_BASE_URL=
AI_API_KEY=
AI_MODEL=

# Docker compatibility mode only
CONTENT_FACTORY_ACCESS_USER=contentfactory
CONTENT_FACTORY_ACCESS_CODE=
CONTENT_FACTORY_DATA_DIR=
CONTENT_FACTORY_BACKUP_DIR=

UPLOADS_ENABLED=true

# 远程账号采集：令牌负责身份验证，Origin 只控制 CORS
CAPTURE_ALLOWED_ORIGINS=
CONTENT_FACTORY_CAPTURE_TOKEN=
```

Feishu should use a self-built enterprise app, not a personal password. The app needs cloud document search/read permissions and visibility to the target docs/wiki.

`AI_BASE_URL` should be OpenAI-compatible. Both of these forms are supported:

- `https://your-gateway.example.com`
- `https://your-gateway.example.com/v1`

生产环境缺少 AI 配置、Supabase 持久化配置或 Docker 访问码时，`/api/health` 会在 `missingRequired` 中明确列出缺项。它只暴露布尔状态和变量名，不返回变量值。

Vercel 模式使用 Supabase Auth 与云端状态，不配置 `CONTENT_FACTORY_DATA_DIR`。Docker 模式必须设置持久化数据目录和访问码。使用 Chrome 扩展时必须设置独立的 `CONTENT_FACTORY_CAPTURE_TOKEN`；`CAPTURE_ALLOWED_ORIGINS` 只决定浏览器 CORS，不作为身份凭证。完整步骤见 [`docs/deployment/Vercel-Supabase-Setup.md`](docs/deployment/Vercel-Supabase-Setup.md)。

## Paid-pilot Docker deployment

为每位客户准备独立的 `.env.production`，然后启动单实例：

```bash
cp .env.example .env.production
# 编辑 .env.production，至少填写访问码、持久化目录、AI 配置和采集令牌
docker compose up --build -d
docker compose ps
```

Compose 使用独立的 `contentfactory-data` 和 `contentfactory-backups` 持久化卷。不要在同一个客户实例中同时把本地文件和 Supabase 当作权威数据源。

## V1 creation flow

首次使用会进入企业建档：系统复用已经连接的知识库、账号定位和写作风格，只要求补齐企业业务、账号定位和主渠道。建档完成后可以生成第一份 30 天内容计划，并从本周优先选题进入快速创作：确认 AI 匹配的知识依据后，系统生成一篇主渠道稿、自动审核，再交给用户人工确认。多渠道生成、爆款改写和精细控制保留在高级创作工作台。

1. Confirm the current account positioning.
2. Generate and confirm a 30-day content plan, or enter the advanced creation workspace directly.
3. Choose a weekly plan item and confirm the AI-matched knowledge sources.
4. Generate one primary-channel draft, review the AI findings, and confirm it manually.
5. In advanced creation, choose original creation or a stored inspiration for viral rewriting.
6. Enter a topic or select a suggested direction.
7. Generate and confirm one shared content brief with traceable citations and optional inspiration structure.
8. Generate any combination of WeChat article, Xiaohongshu note, Moments post, and short-video script. The current product does not render a final video.
9. Run AI review, edit, save versions, and confirm the content is publishable.
10. Copy or export for manual publication, then record the real link, metrics, leads, and qualitative feedback in the content library.
11. After at least two real feedback records in one plan week, generate and confirm the evidence-backed continue / reduce / adjust review; otherwise the system only shows data gaps.

Chrome 扩展是账号定位的可选采集入口：只读取用户主动打开页面中的可见账号和作品信息，先预览采集结果，再生成可编辑的 AI 定位，只有用户最后确认才会覆盖当前账号。小红书账号与作品指标会作为带时间的本地快照保留，公开页未展示的阅读/曝光不会被推测或替代。

Viral rewriting is optional and never blocks original creation. Automatic viral-content collection and automatic publication are not part of V1.

The first Chrome extension prototype lives in:

```text
extensions/contentfactory-capture
```

## Local data

Successful P0 runs save the minimum local workflow state:

- The single confirmed account context
- The current 30-day content plan and its human-edited or locked items
- Content projects and confirmed briefs
- Citation excerpts and selected knowledge references
- Per-channel drafts and generation status
- Viral inspiration references and analysis
- AI review, manual versions, approval status, and manual publication metrics
- Versioned weekly reviews whose suggestions cite real plan items and publication records
- Xiaohongshu visual storyboards

The local/Docker data files are ignored by Git:

```bash
data/contentfactory.local.json
data/content-projects.local.json
data/content-plans.local.json
data/weekly-reviews.local.json
data/knowledge-sources.local.json
```

Local knowledge uses a separate privacy boundary:

- The selected directory handle and Markdown/TXT lightweight index stay in browser IndexedDB.
- Local text is read in the browser to build a capped search index; the complete current text is read again only for preview or later explicit use.
- Connected Feishu sources save identifiers and timestamps to `data/knowledge-sources.local.json`; full local directories are never copied to the server.

Vercel 模式将业务状态保存到客户 Supabase workspace；Docker 模式的数据目录由 `CONTENT_FACTORY_DATA_DIR` 指定并放在持久化磁盘。两种模式的备份、恢复和客户数据删除要求见 [`docs/deployment/Paid-Pilot-Deployment-Checklist.md`](docs/deployment/Paid-Pilot-Deployment-Checklist.md)。模型、生图和市场调用只记录次数、耗时、失败状态、token 用量和可选成本估算，不记录完整提示词、知识正文或生成稿。

## Known limits

- Word/PDF parsing is intentionally not included in this spike.
- Feishu endpoint compatibility must be verified with real app permissions.
- Local folder access requires desktop Chrome or Edge with the File System Access API.
- 扩展对平台 DOM 结构的识别是启发式的；平台改版后可能需要更新选择器。
- 远程部署的 `/api/capture/*` 和 `/api/topics/search-plan` 必须携带独立采集令牌；精确扩展 Origin 只用于 CORS。只有非生产环境的本地回环地址允许 Chrome 扩展免令牌调试。
- 付费试点内置单实例访问码；它不是用户系统。公网交付仍应增加反向代理身份验证或企业访问网关。
- Real publication, seven-day repeated use, customer co-review, and purchase willingness require human evidence and cannot be automated.
- Automatic video production is not yet part of this repository. The external PoC proves the rendering direction, but media upload, a private media bucket, asynchronous Worker jobs, final-video review, and mobile preview/download must be completed before it becomes a paid-delivery capability. See the video roadmap.

## Verification

Run the repeatable technical acceptance suite:

```bash
npm run test:acceptance
```

The API suite starts an isolated local AI mock, uses a temporary `CONTENT_FACTORY_DATA_DIR`, and runs the API flow across account → content plan → knowledge/inspiration → brief → project → channels → review → human approval → versions → publication feedback → weekly review.

Run the acceptance suite after stopping a development server in the same worktree, or run it from a dedicated worktree, because Next.js prevents two processes from sharing the same `.next` directory.

To rehearse with a real customer-owned Markdown/TXT file without committing its contents:

```bash
ACCEPTANCE_ACCOUNT_NAME="客户账号名" \
ACCEPTANCE_TOPIC="真实业务选题" \
ACCEPTANCE_KNOWLEDGE_FILE="/absolute/path/to/customer-material.md" \
npm run test:api
```

See [`docs/acceptance/P0-Acceptance-Manual.md`](docs/acceptance/P0-Acceptance-Manual.md) for technical and manual acceptance, [`docs/acceptance/V1-Real-Knowledge-Pack-Manifest.md`](docs/acceptance/V1-Real-Knowledge-Pack-Manifest.md) for the first real knowledge pack, and [`docs/acceptance/V1-7-Day-Real-Use-Log.md`](docs/acceptance/V1-7-Day-Real-Use-Log.md) for daily timing, modification ratio, publication, metrics, and the enterprise handoff gate.
