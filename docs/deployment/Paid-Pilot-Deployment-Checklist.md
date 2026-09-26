# 内容工厂付费试点部署清单

> 更新：2026-09-26
> 代码基线：`main`（包含 `a01f272`）
> 适用范围：每家客户一个独立实例，不共享 workspace、密钥或生产数据。它不是公开注册的多租户 SaaS。

## 1. 部署模式二选一

| 模式 | 权威业务数据 | 身份认证 | 备份/恢复 | 适用场景 |
|---|---|---|---|---|
| Vercel + Supabase（托管首选） | Supabase Postgres-backed cloud adapter + private Storage | Supabase Auth | Supabase 项目备份和隔离恢复演练 | 客户通过正式域名、手机和多设备使用 |
| Docker / 传统 Node（兼容） | 持久化目录中的 SQLite / JSON / 上传 | 单实例访问码或企业访问网关 | `npm run data:backup` / `data:restore` | 私有服务器或暂不使用 Supabase 的环境 |

同一客户实例只能选择一个权威存储模式。不得将本地 JSON/SQLite 与 Supabase 同时当作真实数据源。

## 2. Vercel + Supabase 托管清单

详细步骤见 `docs/deployment/Vercel-Supabase-Setup.md`。

- [ ] 创建客户 Production 专用 Supabase 项目或 workspace，并执行 `supabase/migrations/202609200001_content_factory_cloud.sql`；
- [ ] 创建杏仁 owner 和客户 member 用户，关闭公开注册；
- [ ] 配置 Vercel Production 的 Supabase URL、publishable key、secret key、workspace ID、站点 URL 和 AI 密钥；
- [ ] Preview 使用不同 Supabase 项目或不同 workspace，不写入客户 Production；
- [ ] `/api/health` 只返回配置状态，不返回密钥、用户或正文；
- [ ] 未登录访问转到登录页，非 workspace 成员显示未开通；
- [ ] owner 可查看内部调用/成本汇总，member 无法访问运营接口；
- [ ] 建档 → 30 天计划 → 快速创作 → 审核 → 人工发布记录在刷新、重新登录和另一台设备后一致；
- [ ] 完成数据库备份策略和一次隔离恢复演练；
- [ ] 绑定正式 HTTPS 域名，用客户真实手机和网络走通登录、复制正文、取图和数据回填；
- [ ] 客户终止服务时，有可核对的 workspace 数据、Storage 对象、Auth 用户、环境变量和备份删除清单。

## 3. Docker / 传统 Node 兼容清单

必需配置：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`CONTENT_FACTORY_ACCESS_CODE`、`CONTENT_FACTORY_DATA_DIR`。使用 Chrome 扩展时还必须配置 `CONTENT_FACTORY_CAPTURE_TOKEN`；`CAPTURE_ALLOWED_ORIGINS` 只限制 CORS，不是身份凭据。

```bash
cp .env.example .env.production
# 编辑 .env.production，不要提交该文件
docker compose up --build -d
docker compose ps
```

上线前：

- [ ] 未带授权访问首页返回 `401`，错误访问码同样被拒绝；
- [ ] `/api/capture/import` 无 Token 或伪造 Origin 时返回 `403`，正确 Bearer Token 才能进入业务校验；
- [ ] 重启容器后账号、计划、草稿、发布记录和调用日志仍存在；
- [ ] 数据和备份目录是持久化卷，不在临时容器文件系统；
- [ ] 先完成一次备份与恢复演练，再开始收费试用。

本地数据命令：

```bash
npm run data:backup
npm run data:restore -- /absolute/path/to/backup --confirm=RESTORE
npm run data:delete -- --confirm=DELETE_CUSTOMER_DATA
```

恢复只使用通过 SHA-256 清单校验的备份。删除是不可恢复操作，必须先取得客户明确确认并按约定处理最终备份。

## 4. 两种模式共同验收

1. `GET /api/health` 达到当前模式的 ready 条件，必需配置无缺失；
2. 使用一份客户授权资料跑通知识搜索、简报、主渠道生成、审核和人工确认；
3. 生图、飞书和市场数据未配置时，页面给出可理解提示且不阻塞主流程；
4. 调用日志只包含模型、任务、Token、耗时、状态和成本元数据，不含密钥、完整提示词、知识正文或生成稿；
5. 390、768、1280、1440 px 的关键页面无非预期横向滚动；
6. 备份、恢复、删除、负责人和保留期限已写入客户交付记录。

## 5. 当前视频边界

本部署清单验收的是图文内容、小红书卡片和短视频脚本，不是最终 MP4。当前不配置视频 Worker 密钥，也不把视频渲染加入上线检查。

未来视频上线前必须另行验证：独立私有 OSS、shared/workspace 隔离、分片/断点上传、可剪片段与权利字段、Worker 认证、幂等/重试/取消、非黑屏/非静音检查、成片审核、移动端预览与可核对删除。

## 6. 回滚与故障处理

- 代码回滚：回到上一个已验证部署，不自动覆盖数据；
- 数据回滚：只从已校验备份恢复，先在隔离环境验证；
- AI 或生图故障：查看不含正文的失败类型和耗时，不打印客户正文；
- 市场数据故障：继续使用企业知识、已有选题和创作流程，恢复后再刷新情报。
