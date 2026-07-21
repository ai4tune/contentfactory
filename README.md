# Content Factory

This repository contains the runnable pre-realignment prototype and the approved Content Factory V0.1 product baseline.

## Source of truth

- Product requirements: `docs/prd/Content-Factory-MVP-PRD-v0.1.md`
- Technical specification: `docs/specs/AI-Growth-OS-Spec-v1.0.md`
- Current code audit: `docs/audits/Content-Factory-MVP-Code-Audit-2026-07-20.md`
- Branch and code ownership: `docs/development/P0-Code-Ownership-and-Branch-Strategy.md`

The implemented P0 direction is:

- Web app, single-enterprise deployment.
- Customer-owned knowledge base first.
- Local Markdown/TXT folders first, with Feishu as the enterprise knowledge connector.
- Temporary local text upload as fallback.
- Omni/OpenAI-compatible AI gateway for generation.
- No multi-tenant SaaS, no database, no heavy auth in this phase.
- Current account state is saved to `data/contentfactory.local.json`.
- Confirmed briefs and channel drafts are saved atomically to `data/content-projects.local.json`.

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

## P0 creation flow

1. Confirm the current account positioning, or skip it temporarily.
2. Connect a local Markdown/TXT folder or Feishu knowledge source.
3. Select 1–5 real source documents and enter or request a topic.
4. Generate and manually confirm one shared content brief with traceable citations.
5. Select any combination of WeChat article, Xiaohongshu note, Moments post, and short-video script.
6. Generate all selected channels together or retry one failed channel.

Chrome 扩展是账号定位的可选采集入口：只读取用户主动打开页面中的可见账号和作品信息，先预览采集结果，再生成可编辑的 AI 定位，只有用户最后确认才会覆盖当前账号。小红书账号与作品指标会作为带时间的本地快照保留，公开页未展示的阅读/曝光不会被推测或替代。

Hot-content analysis and publication metrics are not prerequisites for this P0 flow.

The first Chrome extension prototype lives in:

```text
extensions/contentfactory-capture
```

## Local data

Successful P0 runs save the minimum local workflow state:

- The single confirmed account context
- Content projects and confirmed briefs
- Citation excerpts and selected knowledge references
- Per-channel drafts and generation status

The local data file is ignored by Git:

```bash
data/contentfactory.local.json
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

The API suite starts an isolated local AI mock, exercises the account → knowledge → brief → project → four-channel flow, and restores any pre-existing local data files when it exits.

To rehearse with a real customer-owned Markdown/TXT file without committing its contents:

```bash
ACCEPTANCE_ACCOUNT_NAME="客户账号名" \
ACCEPTANCE_TOPIC="真实业务选题" \
ACCEPTANCE_KNOWLEDGE_FILE="/absolute/path/to/customer-material.md" \
npm run test:api
```

See [`docs/acceptance/P0-Acceptance-Manual.md`](docs/acceptance/P0-Acceptance-Manual.md) for browser checks, privacy checks, modification-ratio recording, publishability, and the approximately CNY 3,000 willingness interview.
