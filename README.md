# Content Factory

This repository contains the runnable Content Factory V1 baseline for real-use and paid-delivery validation.

## Source of truth

- Product requirements: `docs/prd/Content-Factory-MVP-PRD-v0.1.md`
- Paid-pilot service blueprint: `docs/sbd/Content-Factory-Paid-Pilot-SBD-v1.0.md`
- Technical specification: `docs/specs/AI-Growth-OS-Spec-v1.0.md`
- Execution order: `todo.md`
- Historical code audit: `docs/audits/Content-Factory-MVP-Code-Audit-2026-07-20.md`
- Branch and code ownership: `docs/development/P0-Code-Ownership-and-Branch-Strategy.md`

The implemented V1 direction is:

- Web app, single-enterprise deployment.
- Customer-owned knowledge base first.
- Local Markdown/TXT folders first, with Feishu as the enterprise knowledge connector.
- Temporary local text upload as fallback.
- Omni/OpenAI-compatible AI gateway for generation.
- No multi-tenant SaaS or heavy auth in this phase; market data uses SQLite while the creation domain keeps atomic local stores.
- Current account state is saved to `data/contentfactory.local.json`.
- Confirmed briefs and channel drafts are saved atomically to `data/content-projects.local.json`.
- Original creation and optional viral-rewrite creation share one brief and review flow.
- Xiaohongshu supports one generated cover plus editable text-based content cards.
- Content library supports manual publication links, real metrics, leads, qualitative feedback, and evidence-backed weekly review; automatic publishing is not included.
- The viral-content library stores structured source identity and engagement snapshots, deduplicates repeat imports, and keeps legacy records readable.
- A versioned 30-day `ContentPlan` stores 3–5 pillars, 30 ideas, weekly priorities, evidence, human locks, and links to content projects.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` from `.env.example`.

```bash
FEISHU_APP_ID=
FEISHU_APP_SECRET=

AI_BASE_URL=
AI_API_KEY=
AI_MODEL=

UPLOADS_ENABLED=true

# 远程账号采集可选：精确扩展 Origin，或访问码
CAPTURE_ALLOWED_ORIGINS=
CONTENT_FACTORY_CAPTURE_TOKEN=
```

Feishu should use a self-built enterprise app, not a personal password. The app needs cloud document search/read permissions and visibility to the target docs/wiki.

`AI_BASE_URL` should be OpenAI-compatible. Both of these forms are supported:

- `https://your-gateway.example.com`
- `https://your-gateway.example.com/v1`

## V1 creation flow

首次使用会进入企业建档：系统复用已经连接的知识库、账号定位和写作风格，只要求补齐企业业务、账号定位和主渠道。建档完成后可以生成第一份 30 天内容计划，并从本周优先选题进入快速创作：确认 AI 匹配的知识依据后，系统生成一篇主渠道稿、自动审核，再交给用户人工确认。多渠道生成、爆款改写和精细控制保留在高级创作工作台。

1. Confirm the current account positioning.
2. Generate and confirm a 30-day content plan, or enter the advanced creation workspace directly.
3. Choose a weekly plan item and confirm the AI-matched knowledge sources.
4. Generate one primary-channel draft, review the AI findings, and confirm it manually.
5. In advanced creation, choose original creation or a stored inspiration for viral rewriting.
6. Enter a topic or select a suggested direction.
7. Generate and confirm one shared content brief with traceable citations and optional inspiration structure.
8. Generate any combination of WeChat article, Xiaohongshu note, Moments post, and short-video script.
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

The local data file is ignored by Git:

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

## Known limits

- Word/PDF parsing is intentionally not included in this spike.
- Feishu endpoint compatibility must be verified with real app permissions.
- Local folder access requires desktop Chrome or Edge with the File System Access API.
- 扩展对平台 DOM 结构的识别是启发式的；平台改版后可能需要更新选择器。
- 远程部署的 `/api/capture/account` 必须配置精确扩展 Origin 或访问码；只有本地回环地址默认允许 Chrome 扩展调用。
- 除账号采集接口的最小边界外，完整访问控制尚未实现；部署时应放在可信网络或增加独立访问保护。
- Real publication, seven-day repeated use, customer co-review, and purchase willingness require human evidence and cannot be automated.

## Verification

Run the repeatable technical acceptance suite:

```bash
npm run test:acceptance
```

The API suite starts an isolated local AI mock, runs 25 API subtests across account → content plan → knowledge/inspiration → brief → project → channels → review → human approval → versions → publication feedback → weekly review, and restores pre-existing local data files when it exits.

Run the acceptance suite after stopping a development server in the same worktree, or run it from a dedicated worktree, because Next.js prevents two processes from sharing the same `.next` directory.

To rehearse with a real customer-owned Markdown/TXT file without committing its contents:

```bash
ACCEPTANCE_ACCOUNT_NAME="客户账号名" \
ACCEPTANCE_TOPIC="真实业务选题" \
ACCEPTANCE_KNOWLEDGE_FILE="/absolute/path/to/customer-material.md" \
npm run test:api
```

See [`docs/acceptance/P0-Acceptance-Manual.md`](docs/acceptance/P0-Acceptance-Manual.md) for technical and manual acceptance, [`docs/acceptance/V1-Real-Knowledge-Pack-Manifest.md`](docs/acceptance/V1-Real-Knowledge-Pack-Manifest.md) for the first real knowledge pack, and [`docs/acceptance/V1-7-Day-Real-Use-Log.md`](docs/acceptance/V1-7-Day-Real-Use-Log.md) for daily timing, modification ratio, publication, metrics, and the enterprise handoff gate.
