# 生图 405 与主题搜索保存失败：本地修复验收

日期：2026-10-08。分支：`fix/image-market-reliability`，基于 `main@36d5d05`。
工作区：`/Users/renxiaokang/connor/berich/内容工厂/.worktrees/image-market-reliability`。

## 根因与修复

- 生图：生产 `IMAGE_BASE_URL` 和 `IMAGE_MODEL` 末尾存在换行。原代码把带换行的 `/v1` 地址再次追加 `/v1/images/generations`，实际请求 `/v1/v1/images/generations`，空请求复现 405。调用时清理地址、模型、密钥与尺寸的首尾空白，继续支持域名、`/v1` 和完整生成端点。
- 搜索：线上 `/api/market/search` 日志为 `Cloud state update conflicted too many times (db:market-items)`。原来每页 20 条数据并行更新同一份云端状态，争抢版本号。现在每批结果在一次带版本校验的云端更新中完成去重与合并；冲突时重读并重新合并整批，不增加重试上限。单条保存入口复用同一规则，本地 SQLite 沿用原逐条保存实现。
- 已有记录 ID、正文、创建时间、未知字段及其他记录继续保留；空批次不写入。没有新增数据迁移或回填。

## 验证结果

专项测试先在旧代码上复现生图配置失败和 20 条保存冲突；修改后全部通过。

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 通过，包括完整 TypeScript 检查 |
| `npm run lint` | 通过；仅两处已有未使用变量警告 |
| `npm run test:guardrails` | 38 项通过，含 7 项新增专项回归 |
| `node --test src/tests/account-isolation.test.mjs` | 12 项通过 |
| `node --test src/tests/core-api.test.mjs` | 31 项通过，含封面生成、内页编辑、重试与 PNG 下载 |
| `git diff --check` | 通过 |

专项覆盖：生图配置空白与不同端点写法、20 条结果一次完整保存、同账号并发搜索的冲突重试、跨账号隔离、旧记录保留、失败不部分保存、批内去重、空批次零写入和本地数据库兼容。

旧数据只读验收使用本地模拟旧版本记录，阻断并统计写入；确认读取无写入尝试，payload、version、时间戳与归属完全不变。全部写入测试只使用内存模拟数据库或临时目录，未连接生产客户空间。

## 本地复验

在上述工作区运行：

```sh
npm run build
npm run lint
npm run test:guardrails
node --test src/tests/account-isolation.test.mjs
node --test src/tests/core-api.test.mjs
```

生图测试使用模拟服务，证明调用参数与应用流程修复；未执行真实模型出图，模型服务实际可用性仍需用户在发布后主动验证。生产环境变量未修改。改动保留本地，未提交、push、创建 PR、合并或发布；生产修复尚未生效。
