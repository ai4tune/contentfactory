# Vercel + Supabase 客户实例部署

> 更新：2026-09-26
> 适用代码：`main`（包含 `a01f272`）
> 当前状态：真实 Production、正式域名和 Supabase migration 已完成；仍需创建 Auth 用户、加入 workspace，并完成跨设备、移动端、备份恢复和客户数据删除验收。

目标：客户通过正式域名访问，用邮箱账号和密码登录；业务数据跨设备保存；客户不安装软件、不配置模型密钥。

## 架构选择

- Vercel：Next.js 页面、Server Components 和 API Routes。
- Supabase Auth：邮箱与密码登录。
- Supabase Postgres：当前单客户实例的账号、计划、草稿、审核、市场数据和调用日志。
- Supabase Storage：当前图文范围内的私有门店图片、资料和生成资产。后续视频/音乐使用独立私有 OSS，不改造当前图文资产桶。
- 每位首批客户仍使用独立 Vercel 项目和独立 Supabase workspace；暂不建设公开注册、付费和复杂多租户后台。

App Router 使用 `@supabase/ssr`。浏览器只获得 URL 和 publishable key；secret key 只存在于 Vercel 服务端环境变量。

## 需要准备的资源

### 1. Supabase

使用现有 Supabase 项目即可。建议客户生产数据使用独立项目；如果复用已有项目，必须确认其他 Auth 用户不会被加入本 workspace。

需要取得：

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Secret key（`sb_secret_...`）→ `SUPABASE_SECRET_KEY`，仅服务端保存。旧项目的 `service_role` key 仍兼容，但新部署优先使用 secret key

在 SQL Editor 执行：

`supabase/migrations/202609200001_content_factory_cloud.sql`

然后在 Authentication → Users 创建两个账号：杏仁运营账号和客户账号。使用邮箱与初始密码，按双方约定决定是否要求首次改密。不要开放公开注册。

先创建 workspace，并保存返回的 workspace UUID：

```sql
insert into public.content_factory_workspaces (name)
values ('颖姐咖啡店')
returning id;
```

再把两个 Auth 用户加入同一 workspace：

```sql
insert into public.content_factory_workspace_members (workspace_id, user_id, role)
values
  ('替换为 workspace UUID'::uuid, '替换为杏仁用户 UUID'::uuid, 'owner'),
  ('替换为 workspace UUID'::uuid, '替换为颖姐用户 UUID'::uuid, 'member');
```

workspace UUID 配置为 `CONTENT_FACTORY_WORKSPACE_ID`。owner 可以查看内部调用与成本汇总，member 只能使用客户业务功能。

### 2. Vercel

- 一个可部署商业项目的 Vercel 账号/Team；Hobby 方案不用于商业客户生产交付。
- GitHub 仓库访问权限，Vercel 项目 Root Directory 指向 `contentfactory`（如果仓库根目录已经是本目录则留空）。
- Production 与 Preview 使用不同 Supabase 项目或至少不同 workspace。Preview 禁止写入客户生产 workspace。
- Vercel Functions 的区域尽量接近 Supabase 数据库区域。
- Hobby 验证环境中的 Serverless Function `maxDuration` 必须在 1～300 秒内；仓库 guardrail 测试会拒绝更大的值。商业试用交付前仍应升级到适合商业使用的方案。

### 3. 域名

- 一个确定的正式域名或子域名，例如 `content.example.com`。
- 域名 DNS 管理权限；等 Preview 验收通过后再绑定 Production。
- 配置完成后把 `NEXT_PUBLIC_SITE_URL` 改为正式 HTTPS 地址。

## Vercel 环境变量

生产必需：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CONTENT_FACTORY_WORKSPACE_ID=
NEXT_PUBLIC_SITE_URL=https://你的域名

AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_REQUEST_TIMEOUT_MS=60000
```

按功能配置：

```env
IMAGE_BASE_URL=https://img.xingren.me/v1
IMAGE_API_KEY=
IMAGE_MODEL=gpt-image-2
IMAGE_SIZE=1024x1536
IMAGE_REQUEST_TIMEOUT_MS=180000

REDFOX_API_KEY=
REDFOX_BASE_URL=https://redfox.hk
MARKET_REQUEST_TIMEOUT_MS=12000

FEISHU_APP_ID=
FEISHU_APP_SECRET=

CONTENT_FACTORY_CAPTURE_TOKEN=
CAPTURE_ALLOWED_ORIGINS=
UPLOADS_ENABLED=true
```

内部成本可选：

```env
AI_INPUT_COST_PER_1M=
AI_OUTPUT_COST_PER_1M=
IMAGE_COST_PER_REQUEST=
MARKET_COST_PER_REQUEST=
```

不再为 Vercel 配置 `CONTENT_FACTORY_DATA_DIR`、`CONTENT_FACTORY_BACKUP_DIR` 和页面 Basic Auth 访问码。Docker 兼容部署仍可使用这些变量。

## 密钥交付方式

不要在聊天、文档、Git commit 或截图里发送密钥。推荐顺序：

1. 创建并连接 Vercel 项目；
2. 在 Vercel Dashboard → Settings → Environment Variables 中填写；
3. Supabase secret、AI、图片、市场和飞书密钥标记为 Sensitive，只给 Production；
4. Preview 使用单独测试值；
5. 本地需要验证时，通过 `vercel env pull .env.local --environment=preview` 拉取，不提交 `.env.local`。

## 现有数据迁移

先执行 migration 并配置四个 Supabase 环境变量。迁移脚本默认只显示将迁移的 store，不写云端：

```bash
node ops/migrate-local-data-to-supabase.mjs
```

核对后执行：

```bash
node ops/migrate-local-data-to-supabase.mjs --confirm=MIGRATE
```

目标 workspace 已有同名数据时脚本会停止。只有已备份且明确需要覆盖时才加 `--replace`。

## 上线验收

1. Preview 构建和迁移检查通过；未登录页面跳转登录，未授权用户显示未开通。
2. 登录后完成建档、30 天计划、快速创作、审核和发布记录；刷新、重新登录及另一台设备数据一致。
3. 市场缓存、调用日志和图片流程在 Vercel Functions 中正常；长生成没有超时或重复项目。
4. Production 与 Preview 数据隔离；运营接口没有暴露给客户账号。
5. 完成 Supabase 数据库备份/恢复方案和一次隔离恢复演练。
6. 绑定正式域名，用客户真实手机和网络完成登录、复制正文、取图和回填。

Production 通过以上验收后再把账号和域名交给客户。

## 当前视频范围

本次 Vercel 部署只验收图文内容、小红书图卡和 `short_video_script`，不宣布自动 MP4 生产已上线。当前 migration 中的 `content-factory-assets` 桶限制为 20 MB，且未开放视频/音频 MIME，不得直接当作视频媒体库。

后续视频接入需要单独实施：

1. 创建独立私有 OSS 媒体面，建立 shared 通用库与 workspace 私有库隔离；
2. 大文件使用分片/断点上传，并记录可剪片段、来源、权利、校验和删除状态；
3. 部署独立异步 Video Worker，内容工厂 API 只创建任务和查询状态；
4. 完成非黑屏、非静音、时长/尺寸、成片人工审核和手机下载验收。

具体对象、PR 顺序和闸门见 `docs/roadmap/Content-Factory-Video-Production-Roadmap-2026-09-22.md`；素材分类和入库规则见 `docs/roadmap/Video-Asset-Library-Catalog-v0.1.md`。
