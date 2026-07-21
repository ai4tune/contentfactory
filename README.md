# Content Factory

This repository contains the runnable pre-realignment prototype and the approved Content Factory V0.1 product baseline.

## Source of truth

- Product requirements: `docs/prd/Content-Factory-MVP-PRD-v0.1.md`
- Technical specification: `docs/specs/AI-Growth-OS-Spec-v1.0.md`
- Current code audit: `docs/audits/Content-Factory-MVP-Code-Audit-2026-07-20.md`
- Branch and code ownership: `docs/development/P0-Code-Ownership-and-Branch-Strategy.md`

The approved V0.1 direction is:

- Web app, single-enterprise deployment.
- Customer-owned knowledge base first.
- Local Markdown/TXT folders first, with Feishu as the enterprise knowledge connector.
- Temporary local text upload as fallback.
- Omni/OpenAI-compatible AI gateway for generation.
- No multi-tenant SaaS, no database, no heavy auth in this phase.
- Local workflow records are saved to `data/contentfactory.local.json`.

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
```

Feishu should use a self-built enterprise app, not a personal password. The app needs cloud document search/read permissions and visibility to the target docs/wiki.

`AI_BASE_URL` should be OpenAI-compatible. Both of these forms are supported:

- `https://your-gateway.example.com`
- `https://your-gateway.example.com/v1`

## Current prototype flow

The current code still reflects the pre-realignment prototype and is being migrated through the ordered PR plan in the audit document:

1. Analyze account positioning.
2. Generate keyword groups and search tasks in topic radar.
3. Manually search hot content on Xiaohongshu, WeChat Channels, WeChat Official Accounts, or other platforms.
4. Paste hot samples into the inspiration library for structure analysis.
5. Convert hot sample insights into owned topic candidates.
6. Combine Feishu/local knowledge sources to generate outlines, drafts, audit notes, and citations.

Chrome extension or browser automation is treated as an import method. It fills the same hot sample fields as manual entry and does not change the core workflow.

The first Chrome extension prototype lives in:

```text
extensions/contentfactory-capture
```

## Local data

Successful AI runs are saved locally:

- Account positioning records
- Topic radar records
- Inspiration analysis records
- Article draft records

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
- Generated drafts use the legacy single-channel record and will be migrated to the P0 content-project model.
- Local folder access requires desktop Chrome or Edge with the File System Access API.
- The capture extension currently imports single content pages into the inspiration library; P0 will repurpose it for account-page capture.
- Access control is not implemented yet; keep this local or behind a trusted deployment boundary until the next phase.
