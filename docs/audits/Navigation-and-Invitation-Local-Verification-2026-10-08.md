# 菜单切换与管理员邀请：本地验证

日期：2026-10-08。分支：`fix/navigation-invitations`。基线：`86a12fd`。

## 改动

- 删除根级整页空白加载界面。菜单切换完成前保留当前页面；等待超过 200ms 时显示右上角轻量提示。
- 页面渲染内，对成员校验和相同个人空间资料读取使用 React request cache 去重。缓存不跨请求，资料缓存键包含个人空间 ID。
- 管理员侧边栏增加“邀请用户”，地址 `/operations/invitations`。
- `POST /api/operations/invitations` 校验当前邀请空间的 owner 权限，校验邮箱及请求来源，发送邀请后开通 member 权限。
- 已注册邮箱补齐访问权限并提示直接登录；已有角色采用 ignoreDuplicates 保留，不重置密码或客户内容。邮件与权限不能同时成功时明确提示部分失败，可用原邮箱重试。

## 本地检查

- 生产构建和改动文件 ESLint 通过；`git diff --check` 通过。
- 21 项 API 与生产保护检查通过：账号隔离、背景任务归属、旧数据零写入、请求内去重及后续请求重新读取、非管理员拒绝、邮箱校验、跨来源拒绝、新用户邀请与授权、邮件失败、权限失败重试、已有 owner 角色保留。
- 浏览器使用本地模拟 Supabase 与模拟邮件服务：发送中转圈并禁用按钮；成功显示邮箱及授权结果；普通成员无入口且直接调用返回 403。
- 模拟资料读取延迟 1 秒：跳转期间旧页面和菜单仍可见；快速返回页面时未闪出提示。
- 旧资料仍可从 `/api/materials` 读取，未知字段保留。阻断客户内容写入并比对隔离旧数据，内容、版本、时间戳与归属保持不变。

复现后台检查（没有配置公网 Supabase 的本地构建）：

```sh
npm ci --no-audit --no-fund
npm run build
node --test src/tests/account-isolation.test.mjs src/tests/production-guardrails.test.mjs
```

本次浏览器构建使用 `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4412`、合成 publishable key；对应 API 检查通过 `ACCOUNT_ISOLATION_SERVICE_PORT=4412` 绑定同一个本地端口。没有复制生产环境文件或获取生产密钥。

## 用户验收入口

当前机器的本地模拟预览：

- 管理员：<http://127.0.0.1:4412/fixture/session?role=owner>
- 普通成员：<http://127.0.0.1:4412/fixture/session?role=member>

预览服务脚本位于 `/tmp/contentfactory-invitation-preview.mjs`，仅使用内存里的合成账号和隔离资料，不会发送真实邮件。脚本运行后应用位于 4411 端口，模拟服务位于 4412 端口。

建议切换企业资料、内容库和邀请入口，再填任意测试邮箱体验发送反馈。普通成员入口会跳到拒绝访问页，可手动打开 `/knowledge` 查看普通成员菜单。

## 验证范围

未向真实邮箱发送验收邮件，未写生产客户空间，未测生产跳页耗时。已有 middleware/Edge 构建提示未在本次改动中扩展处理。未提交、push、创建 PR 或发布；改动留在独立工作区供本地验收。
