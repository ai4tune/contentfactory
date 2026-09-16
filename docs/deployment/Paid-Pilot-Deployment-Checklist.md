# 内容工厂付费试点部署清单

适用范围：V1 付费试点采用“每家客户一个独立实例”，不共享数据库、密钥、访问码或数据目录。它不是多租户 SaaS。

## 1. 实例和访问边界

- 为客户创建独立的代码部署、域名、环境变量和持久化 `data/` 目录。
- 互联网部署优先使用 Cloudflare Access、反向代理身份验证或企业 VPN；应用内访问码作为试点期的最小保护。
- 设置强随机 `CONTENT_FACTORY_ACCESS_CODE`，用户名可通过 `CONTENT_FACTORY_ACCESS_USER` 修改。
- `/api/health` 保持匿名可用，只返回配置状态，不返回密钥；其他页面和 API 需要授权。
- Chrome 扩展使用的 `/api/capture/*` 和 `/api/topics/search-plan` 由精确扩展 Origin 或 `CONTENT_FACTORY_CAPTURE_TOKEN` 单独保护，不经过页面访问码。
- 不要把客户实例放在可公开访问、但没有任何身份验证的网络上。

## 2. 服务端配置

从 `.env.example` 创建部署平台的服务端环境变量，不要提交 `.env.local`：

- 必需：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`CONTENT_FACTORY_ACCESS_CODE`。
- 按功能可选：飞书、生图、市场数据、Chrome 采集配置。
- 费用估算可选：AI 每百万 token 单价、生图单次成本、市场数据单次成本。
- 超时可配置，但应先使用示例默认值。市场数据不可用时，已有过期缓存会降级返回，创作主流程不依赖它。

所有密钥只在服务端读取。禁止新增 `NEXT_PUBLIC_*KEY`、`NEXT_PUBLIC_*SECRET`、`NEXT_PUBLIC_*TOKEN` 等变量。

## 3. 构建与启动

```bash
npm ci
npm run test:acceptance
npm run build
npm run start
```

部署平台必须持久化项目根目录下的 `data/`。滚动部署或容器重建时，不能使用临时文件系统保存客户数据。

## 4. 上线前检查

1. `GET /api/health` 返回 `ready: true`，且 `missingRequired` 为空。
2. 未带授权访问首页返回 `401`；错误访问码也返回 `401`。
3. 正确授权后能进入建档、计划和创作页面。
4. 用一份客户授权资料跑通：知识搜索 → 简报 → 主渠道生成 → 审核 → 人工确认。
5. 生图、飞书和市场数据未配置时，页面给出可理解提示，不阻塞核心创作。
6. `GET /api/operations/summary?days=7` 只显示调用数、失败数、耗时和估算成本，不出现提示词或正文。
7. 完成一次真实备份与恢复演练，再开始收费试用。

## 5. 备份、恢复与删除

执行数据维护前先停止应用，避免 SQLite 或 JSON 文件仍在写入。

```bash
# 默认备份到 backups/contentfactory-时间戳
npm run data:backup

# 校验清单后恢复；旧 data 目录会保留为 data.pre-restore-时间戳
npm run data:restore -- /absolute/path/to/backup --confirm=RESTORE

# 客户确认终止服务后永久删除服务端数据
npm run data:delete -- --confirm=DELETE_CUSTOMER_DATA
```

备份包含 `data/` 中的 SQLite、JSON 和市场缓存，并生成 SHA-256 清单。它不包含浏览器 IndexedDB 中的本地文件夹句柄，也不会复制客户电脑上的原始本地知识库。

## 6. 回滚与故障处理

- 代码回滚：先停止服务，恢复上一版本代码，再启动；不要自动覆盖 `data/`。
- 数据回滚：只使用通过清单校验的备份，并保留恢复前目录，确认无误后再删除。
- AI 或生图故障：检查 `/api/operations/summary` 的失败服务和耗时，不查看或打印客户正文。
- 市场数据故障：先让用户继续使用已有选题、知识库和创作流程；外部数据恢复后再刷新。
