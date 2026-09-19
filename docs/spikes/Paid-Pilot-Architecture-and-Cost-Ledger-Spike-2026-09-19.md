# 付费试点架构与成本账本技术 Spike

> 日期：2026-09-19
> 状态：结论已形成，等待按 `todo.md` 实施
> 适用范围：AI 内容工厂首批单客户独立实例
> 关联文档：PRD、SBD、Spec、`todo.md`

---

# 1. Spike 目标

本次调研回答五个问题：

1. 首批付费客户是否需要立即建设共享多租户；
2. 线上 Web 如何使用客户本地文件夹；
3. 企业资料、账号画像、Skill 和本次任务如何分层；
4. 如何记录 Token、图片和外部数据成本；
5. 正式上线前还缺少哪些安全、持久化和验收能力。

# 2. 当前实现事实

代码基线：`main@f185620`。

已经具备：

- 每客户独立实例的产品决策；
- 浏览器主动选择本地目录、读取 Markdown/TXT 并在 IndexedDB 建立索引；
- 飞书知识读取和统一知识选择器；
- 首次建档、账号定位、风格画像、ContentPlan、快速创作、发布反馈和轻量复盘；
- AI Gateway 统一调用；
- 基础调用日志：模型、输入/输出 Token、耗时、状态和成本字段。

尚未闭环：

- 外部采集接口不能把 `Origin` 当成身份凭证；
- SQLite/JSON/上传目录缺少经过实测的生产持久化、备份和恢复闭环；
- 调用日志不能按任务、Prompt 版本、实际模型和内容项目核算成本；
- Token 或单价缺失时无法明确区分“未知”和“零成本”；
- 本地/飞书资料尚未编译成带来源、可确认和可版本化的企业知识档案；
- 关键页面尚未完成多宽度横向溢出回归。

2026-09-19 检查当前本地数据库最近 7 天 AI 调用：24 次调用、5 次失败、142,583 输入 Token、12,073 输出 Token，2 次成功调用缺少用量；成本汇总为 0，因为没有配置价格且账本字段不足。该数据只作为 Spike 当日样本，不作为长期指标。

# 3. 架构结论

## 3.1 首批交付继续使用独立实例

当前不建设共享 `Workspace → Project → User` 多租户系统。每家客户使用一套独立 Web 实例、独立数据目录、独立密钥和独立备份，实例即租户边界。

原因：

- 首批目标是验证客户是否愿意为结果付费，不是验证 SaaS 账号系统；
- 独立实例已经能隔离客户知识和密钥；
- 提前建设组织、成员、角色、RLS、套餐和支付会扩大范围；
- 单租户数据仍需保持稳定 schema，方便未来迁移。

多租户立项闸门：至少 3 家持续付费客户需要统一升级，或独立实例运维明显影响交付，或出现企业成员/审核角色/跨设备协作的真实需求。

闸门通过后的目标模型是 `Workspace（企业）→ Project（账号/业务项目）→ Member（成员）`。届时文档、知识片段、画像、内容项目、生成记录和用量账本都必须带 `workspace_id + project_id`，后端根据登录身份验证成员归属，不能信任前端自行传入的 Workspace。该模型只作为迁移目标，本轮不落代码和数据表。

## 3.2 知识与方法分层

运行时固定按以下顺序组装：

```text
System Skill
→ Enterprise Profile
→ Account / Brand Profile
→ Knowledge Evidence
→ Current Task
```

- **System Skill**：通用写作、渠道、审核和结构方法，由系统维护并版本化；
- **Enterprise Profile**：企业、产品、客户、经营目标、合规和公开边界；
- **Account / Brand Profile**：当前账号定位、人格、语气、常用和禁止表达；
- **Knowledge Evidence**：本次任务经过用户确认的必要资料片段；
- **Current Task**：选题、内容目标、渠道和用户临时要求。

不为每个客户复制一套 Skill 文件。客户差异通过 Profile 和 Knowledge 表达。

企业、客户、产品和经营目标等重叠字段继续以现有 `AccountContext` 为权威，语气规则继续以风格画像为权威。用户确认企业知识档案时，先更新这些权威字段，再编译带来源和版本的档案快照，不能维护两套会静默分叉的企业资料。

## 3.3 `agent.md` 的职责

`agent.md` 不是完整知识库，只是企业 AI 的精炼运行说明和其他档案文件索引。原始资料继续留在客户本地文件夹、飞书、GitHub 或其他知识源。

可选导出结构：

```text
.content-factory/
├── agent.md
├── brand.md
├── audience.md
├── products.md
└── content_rules.md
```

浏览器读取本地目录需要用户明确授权；写入上述文件需要再次申请读写权限。网页不能在用户未授权时后台持续访问任意本地目录。跨设备优先依靠飞书、GitHub 或用户自己的文件同步；常驻 Local Connector 后置。

# 4. Token 与成本账本方案

## 4.1 记录对象

每次文本、图片和外部数据调用都生成一条账本记录，并尽量关联业务对象：

```text
task_type
prompt_version
requested_model
resolved_model
provider
entity_type
entity_id
request_id
usage_source
input_tokens
output_tokens
input_rate_per_1m_snapshot
output_rate_per_1m_snapshot
text_cost_estimate
image_cost_estimate
external_cost_estimate
total_cost_estimate
currency
duration_ms
status
error_code
error_message
created_at
```

不记录完整 Prompt、完整知识正文、密钥或完整生成内容。

## 4.2 用量来源

| `usage_source` | 含义 | 展示方式 |
|---|---|---|
| `gateway` | 网关真实返回 Token | 真实用量 |
| `estimated` | 本地估算 | 明确标注估算 |
| `missing` | 无法取得 | 未知，不参与已知成本合计 |

如果请求模型是 `smart` 等路由别名，必须同时记录 `requested_model` 和响应中的 `resolved_model`。网关未返回实际模型时标为未知，不能猜测。

## 4.3 成本公式

```text
文本输入成本 = input_tokens / 1,000,000 × input_rate_snapshot
文本输出成本 = output_tokens / 1,000,000 × output_rate_snapshot
文本成本 = 文本输入成本 + 文本输出成本
图片成本 = image_count × image_unit_rate_snapshot
外部数据成本 = request_units × request_unit_rate_snapshot
任务总成本 = 文本成本 + 图片成本 + 外部数据成本
```

单价随调用保存快照。Token 或单价缺失时，对应成本为 `null`，不能保存为 0。

## 4.4 第一版任务分类

- `positioning_analysis`；
- `style_profile_generation`；
- `enterprise_profile_generation`；
- `content_plan_generation`；
- `topic_recommendation`；
- `content_brief_generation`；
- `channel_generation`；
- `content_review`；
- `inspiration_analysis`；
- `image_storyboard`；
- `image_generation`；
- `market_query`。

## 4.5 内部运营指标

内部运营页提供 7 天和 30 天：

- 调用、成功、失败和平均耗时；
- 输入/输出 Token 与用量覆盖率；
- 已知成本与未知成本调用数；
- 按任务、模型、日期和业务对象分组；
- 文本、图片、外部数据成本；
- 单篇内容、单项目、单份 30 天计划平均成本。

第一版不建设客户积分、算力余额、充值和额度扣减。界面中的“消耗算力”改为正常功能名称，成本只对运营者可见。

# 5. 上线方案结论

首批付费实例使用自托管 Node/Docker 单实例，服务端数据目录使用持久化卷。当前 SQLite/JSON 权威数据不能直接部署到无持久化文件系统的 Serverless 环境。

上线验收：

1. 未认证页面和业务 API 被拒绝；
2. 外部采集无令牌被拒绝，伪造同源 `Origin` 不能绕过；
3. 正确采集令牌可以完成授权范围内操作；
4. 服务重启后账号、计划、草稿、发布和账本不丢失；
5. 备份可以恢复到同版本新实例；
6. 新客户只更换环境配置和数据目录，不修改业务代码；
7. 密钥不出现在前端包、日志、备份明文说明和 Git 历史。

# 6. 响应式验收方案

自动检查关键路由在 390、768、1280、1440 宽度满足：

```text
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

如果横向导航、表格或卡片轨道确需滚动，只允许组件内部滚动并提供可见提示。不得使用全局 `overflow-x-hidden` 掩盖越界组件。

覆盖路由：`/`、`/setup`、`/plans`、`/create/quick`、`/create`、`/drafts/:id`、`/articles`、`/knowledge`、`/radar`、`/topics`、`/inspirations`。

# 7. 不采用的方案

本轮不采用：

- 立即建设共享多租户、组织成员和 RLS；
- 把每个客户的 Skill 复制成一套独立代码；
- 把整个本地知识库上传到平台云盘；
- 使用 `agent.md` 代替原始知识和证据检索；
- 用请求次数冒充 Token 或把缺失成本记成 0；
- 向首批客户展示虚构的算力积分；
- 建设后台常驻 Local Connector；
- 引入重型向量数据库；
- 用全局隐藏溢出的 CSS 解决横向滚动。

# 8. 实施顺序与退出标准

```text
PR-DOC-0 文档与范围冻结
→ PR-LAUNCH-1 安全、持久化与恢复
→ PR-UX-1 响应式回归
→ PR-COST-1 Token 与成本账本
→ PR-COST-2 内部运营视图
→ PR-KNOWLEDGE-1 企业知识档案
→ PR-ACCEPTANCE-1 黄金路径验收
```

Spike 退出标准：PRD、SBD、Spec 和 `todo.md` 对产品边界、数据模型、成本规则、实施顺序和后置项没有冲突；后续代码 PR 可以直接引用本文件的验收标准。
