# 小掌柜 U03–U05 整合发布验收

日期：2026-10-10（Asia/Shanghai）。用户本次明确授权合并全部已完成升级到 main，并发布现有生产项目。

## 范围与代码

发布前 main / origin/main：`28ef6d3d9f367c1071cd13ed4a97018cfaa08c31`，生产 `dpl_AVbgTFq5VqyfnnninR4AGdPTBhx8`（Ready）。

按依赖顺序在 `release/xiaozhanggui-2026-10-10` 整合：U03 `7321060`、U04 `7f460ad`、U05 `230e4ae`；整合代码 `d143355`。共享冲突保留 U03 日历任务与全部测试，首页替换为最新对话，U05 承接 U04 工具实现。项目上下文约束和 README 也纳入。旧审计稿、未实现 U06/U07 和无关分支保留原状。

## 本次验证

`npm ci` 通过。`npm run test:acceptance` 中 Lint、保护规则、扩展、构建、核心 API / 重启、V2、知识导入 / 后台任务、账户隔离、访谈恢复、首篇 / 交付、对话与调研共 205 项通过。随后高德组因本次浏览器预览占用 4597 端口未启动，属于验收环境冲突。移到独立 4621 / 4622 端口后执行：

```sh
node --test src/tests/agent-amap.test.mjs src/tests/home-plan-calendar.test.mjs src/tests/home-plan.test.mjs
```

32 项全部通过：高德 16、日历 / 首页纯逻辑 10、计划 API 6。累计 237 项，无未解决失败；构建和 Lint 通过，保留两处既有 market 未使用变量警告与 middleware 提示。日志位于本机 `/tmp/contentfactory-u03-u05-acceptance.log` 和 `/tmp/contentfactory-u03-u05-last-groups.log`。

隔离检查覆盖新 / 旧资料读取零写入、版本 / 时间戳 / 未知字段 / 归属不变、跨账户猜 ID 拒绝、计划更新冲突、对话恢复不重生成、研究来源归属、地图中心必须用户确认、错误编号兼容、明确次数跨重试限制及次数耗尽等待。生产个人空间未被用作写入验收。

浏览器任务 17 使用本地临时合成花店与模拟模型：7 天 3 篇计划、手动实拍任务与首页对话并存；提交缺资料诉求后等待补充，刷新可找回对话与任务；1440 桌面 / 390 手机检查，手机 documentWidth 与 viewport 均 390，无横向溢出。预览 Basic Auth 使用请求头，避免带用户名的 URL 导致浏览器 fetch 拒绝；不是生产邮箱登录代码改动。

- [桌面截图](artifacts/release-u03-u05-desktop-2026-10-10.png)
- [手机截图](artifacts/release-u03-u05-mobile-2026-10-10.png)

已知真实密钥扫描：417 个跟踪文件 + 147 个客户端 JS，命中 0；临时凭据与测试数据不进入 Git。

## 生产目标与配置

团队 `team_vSMvnH1XNxLUzPAZUDairmNI`，项目 `contentfactory` / `prj_n53bFMLAVj1s3qtzeST2GstXMEq5`，正式入口 [nrgc.xingren.me](https://nrgc.xingren.me)。连接器 403 后使用本机已登录 Vercel CLI，`.vercel/project.json` 核对目标。

仅新增 Production 的服务端敏感变量 `BRAVE_API_KEY` / `AMAP_API_KEY`，值来自用户已授权使用的本地配置，不写文档或日志。已有 RedFox、登录、存储、模型与生图配置保留；不运行迁移、回填、重置，也不代客户登录保存或生成。

## 部署结果

发布进行中，等待实际 main 提交、部署 ID、Target、Ready、aliases 与公开接口只读检查。历史发布记录保留在其他验收文档，本文件不沿用以前发布授权。

## 尚待完成

U06 每日单篇检查及无计划内容周复盘、U07 真实门店持续试用尚未实现。本轮执行层使用 AI SDK + Workflow，没有接入 DeepSeek Harness。公众号原生粘贴、小红书实际发布、完整贴图模式及真实稿件质量仍需实测；发布软件不等于自动发布用户内容。
