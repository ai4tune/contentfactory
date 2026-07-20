# 内容工厂 MVP 代码差距审计

> 审计日期：2026-07-20  
> 产品依据：`docs/prd/Content-Factory-MVP-PRD-v0.1.md`  
> 技术依据：`docs/specs/AI-Growth-OS-Spec-v1.0.md` v1.2  
> 审计范围：`contentfactory` Web 应用、API、本地存储和 Chrome 插件  
> 本次结果：只审计和规划，不改业务代码

---

# 1. 总体结论

当前代码不需要推倒重来，但产品入口和核心生成流程仍停留在上一版“完整内容平台”方向。

可以继续使用的基础：

- Next.js App Router、TypeScript、Tailwind 的工程基础；
- Omni / OpenAI-compatible AI Gateway 调用封装；
- 飞书 Docx、多维表格读取能力；
- 单账号定位的覆盖保存机制；
- 本地 JSON 持久化作为首轮本地验证方案；
- Chrome 插件的 Manifest V3、当前页可见文本读取和本地 API 通信外壳；
- 现有爆款列表与详情页，作为 P1 资产保留。

必须重做或大幅改造的 P0 主链路：

```text
内容创作默认首页
→ 自动继承当前账号定位
→ 选择本地文件夹 / 飞书知识
→ 确定或推荐选题
→ 生成统一内容简报
→ 多选生成四种渠道内容
→ 事实 / 风格 / 平台审核
→ 人工编辑
→ 保存 / 复制 / 下载
```

当前与上述 P0 直接对应的完成度约为 35%–45%：有可运行原型，但还不是可交付的产品主流程。

---

# 2. 当前技术健康状态

## 2.1 已验证

- `npm run lint`：通过；
- `npm run build`：通过；
- Next.js：16.2.10；
- React / React DOM：19.2.4；
- 生产构建完整编译并列出当前页面和 API Route；
- 本地数据文件可读，当前存在 1 份账号定位和 1 份爆款样本；
- `.env.local` 存在且构建可读取，审计过程未输出其中的凭证。

## 2.2 工程风险

1. 当前仓库 `main` 没有任何提交，所有文件都是 untracked。
2. `origin` 已指向 `https://github.com/ai4tune/contentfactory.git`，但远程没有可见分支。
3. 在建立基线提交前，任何“功能 PR”都会被迫包含整个项目，无法有效审查。
4. `package.json` 没有 `test` 或 E2E 脚本，目前只能依赖 lint、build 和人工测试。

因此，开发前必须先完成一次“无业务改动的初始基线提交”。

---

# 3. 产品差距矩阵

| 能力 | 新 PRD 要求 | 当前状态 | 判断 | 调整方向 |
|---|---|---|---|---|
| 默认首页 | 内容创作是第一入口 | `/` 仍是数据与资产工作台 | 缺失 | 用创作页替换 `/`，旧工作台不再作为 P0 入口 |
| 页面数量 | 只保留创作、当前账号、知识库、草稿历史 | 导航展示 7 个模块 | 范围过大 | 导航收缩为 4 项，P1 页面保留代码但隐藏入口 |
| 单账号保存 | 只保存当前唯一账号 | `saveAccountProfile` 会覆盖数组 | 已有基础 | 保留，增加“确认 / 编辑 / 跳过”状态 |
| 账号采集 | 插件采集账号主页、列表和可见数据 | 插件采集单篇内容，直接进入爆款拆解 | 方向错位 | 保留插件壳，重做账号采集负载和 `/api/capture/account` |
| 账号自动继承 | 选题、简报、四渠道、审核共享完整定位 | 生成 API 只继承 `accountPosition` 一个字段 | 部分完成 | 改为统一 `AccountContext`，自动带入受众、语气、内容支柱和禁区 |
| 本地知识库 | 用户选择文件夹，浏览器读取 Markdown / TXT | 只支持向服务端上传单个文件 | 缺失 | 使用 File System Access API + IndexedDB 保存句柄和轻量索引 |
| 飞书知识 | 连接、搜索、预览、按需引用 | 已有 URL 解析、搜索、Docx / Base 读取 | 可复用 | 保留 API，补来源状态、预览、错误和重连 |
| 知识隐私 | 不复制完整本地知识库 | 上传和飞书读取会将完整正文存入 JSON | 边界不一致 | 本地目录只存元数据与句柄；飞书至少明确告知缓存策略，优先按需读取 |
| 选题 | 创作页内手工输入或基于定位+知识推荐 | 独立“选题雷达”，主要基于定位和爆款 | 部分可复用 | 保留 AI 关键词能力，将简化选题推荐嵌入创作页，不要求爆款输入 |
| 统一内容简报 | 四渠道生成前先固定事实、观点、结构、CTA 和引用 | 当前生成结果只有 `positioning/outline/draft/audit` | 缺失 | 新增 `ContentBrief`，用户确认后才生成渠道内容 |
| 四渠道生成 | 公众号、小红书、朋友圈、短视频脚本，可多选 | 单个下拉框、单篇通用 Prompt，且选项含“视频号” | 缺失 | 固定 4 个 channel enum，分开 Prompt、结果和单渠道重试 |
| AI 审核 | 事实、风格、平台三类问题可定位、可应用 | 与初稿同次返回普通字符串列表 | 缺失 | 审核改为独立阶段和结构化 `ReviewIssue[]` |
| 人工编辑 | 页面内直接编辑、修改和重试 | 结果为只读文本 | 缺失 | 使用 textarea / editor 编辑每个渠道，保留用户修改结果 |
| 导出 | 保存、复制、Markdown 下载 | 均未实现 | 缺失 | 增加渠道级复制和 Markdown 下载，不做自动发布 |
| 草稿历史 | 列表、详情、继续编辑、修改版本 | 内容库只能看摘要和补发布数据 | 部分完成 | 将 `/articles` 改造为草稿历史，发布数据 UI 降为 P1 |
| 爆款库 | P1，不阻塞主流程 | 已有相对完整的列表、详情、采集和拆解 | 功能超前 | 代码保留，从 P0 导航和主流程隐藏 |
| 发布复盘 | P1 | 工作台和内容库高度展示发布数据 | 功能超前 | 隐藏发布指标入口，不删 API，付费验证后再启用 |

---

# 4. 具体代码证据

## 4.1 默认首页和导航仍是旧版

- `src/app/page.tsx:7-13` 把主流程定义为“定位 → 爆款 → 素材 → 生成 → 发布复盘”；
- `src/app/page.tsx:53-77` 主要展示进度、资产数和发布表现；
- `src/components/app-shell.tsx:4-12` 导航仍包含工作台、选题雷达、爆款库和内容库等 7 项；
- `src/components/app-shell.tsx:56-59` 仍将“学习爆款”和“记录数据”定义为必经主流程。

## 4.2 账号定位“存得下”，但还不够自动

- `src/lib/store.ts:83-97` 已实现只保存一个当前账号，符合单账号方向；
- `src/app/positioning/positioning-client.tsx:118-145` 仍以用户手工填写大量业务字段为主；
- `src/app/api/generate/route.ts:16-23` 内容生成只继承账号定位的一段文本，未继承语气、内容支柱和受众等结构化信息。

## 4.3 插件用途与 P0 相反

- `extensions/contentfactory-capture/popup.js:27-40` 采集后调用 `/api/capture/import`，并立即“拆解”；
- `src/app/api/capture/import/route.ts:24-41` 将负载转换为 `InspirationRequest` 并存入爆款库；
- 插件的 API 地址和 host permission 写死为 `localhost:3000`，还不能连接客户独立部署；
- `src/app/api/capture/import/route.ts:52-56` 允许任意来源 CORS，如将应用暴露在公网，需要收紧为已配置插件来源或加入实例访问码。

## 4.4 知识库当前是“上传 / 复制”，不是“本地连接”

- `src/app/materials/page.tsx:50-63` 只支持粘贴飞书 URL 或上传文件；
- `src/app/api/uploads/route.ts:35-43` 会读取完整文件正文并存入本地 JSON；
- `src/lib/feishu.ts:91-112` 和 `src/lib/feishu.ts:177-213` 已具备飞书文档按 ID 读取能力；
- `src/lib/feishu.ts:114-165` 已具备多维表格读取能力；
- `KnowledgeSource.source` 只包含 `feishu | base | upload`，没有 `local-folder`。

## 4.5 当前 AI 只会生成一篇通用稿

- `src/lib/ai.ts:4-18` 的请求和结果结构只容纳单个 `platform` 和单个 `draft`；
- `src/lib/ai.ts:90-119` 使用一个通用 Prompt 同时生成定位、大纲、草稿和审核；
- `src/app/workbench/page.tsx:330-345` 为单选平台，且缺少“朋友圈文案”这个固定渠道；
- `src/app/workbench/page.tsx:349-359` 结果只能查看，不能编辑、重试、复制或下载。

## 4.6 草稿已保存，但数据模型不能承载新流程

- `src/app/api/generate/route.ts:23-26` 生成成功后确实会保存草稿，README 中“Generated drafts are not persisted yet”已过期；
- `src/lib/store.ts:30-50` 的 `ArticleRecord` 没有统一内容简报、多渠道结果、审核问题、用户编辑版本和引用片段；
- `src/lib/store.ts:168-200` 对 JSON 执行“读取→修改→覆盖写入”，没有原子写或并发保护；
- 当四个渠道并行生成时，若各请求独立写整个 JSON，可能相互覆盖。

---

# 5. 建议的最小数据结构

继续使用单实例轻量存储，不引入多租户和复杂数据库。只把现有数据模型改成能承载 P0 主流程的最小形态。

```text
CurrentAccount
- input / capturedProfile
- positioning
- targetAudience
- voice
- contentPillars
- boundaries
- updatedAt

KnowledgeSource
- id
- type: local-folder | feishu | upload
- name
- status
- localHandleKey? / remoteRef?
- indexedAt?

ContentProject
- id
- topic
- accountSnapshot
- selectedKnowledgeRefs
- brief
- channels[]
- createdAt / updatedAt

ChannelDraft
- channel: wechat_article | xiaohongshu_note | moments_post | short_video_script
- content
- reviewIssues[]
- status
- updatedAt

ReviewIssue
- dimension: fact | voice | platform
- severity
- message
- suggestion
- sourceRef?
```

本地文件夹句柄和索引保存在浏览器 IndexedDB，不写入服务端 JSON。草稿与当前账号暂时可继续使用服务端 JSON，但必须采用原子写并避免多个渠道同时覆盖整个文件。

---

# 6. 保留、改造、隐藏、后置

## 6.1 保留

- `src/lib/config.ts`；
- `src/lib/feishu.ts` 的飞书 API 封装；
- `src/lib/ai.ts` 的 Gateway 通信与 JSON 解析基础；
- `src/lib/store.ts` 的单实例本地持久化方向；
- `AppShell` 的视觉基础；
- 单账号定位页面中的结果展示；
- 爆款库列表和详情页作为 P1 备用能力。

## 6.2 改造

- `/` 改为内容创作页；
- `/positioning` 改为当前账号页；
- `/materials` 改造为 `/knowledge`；
- `/articles` 改造为 `/drafts`；
- `GenerateRequest / GenerateResult` 改为内容项目、简报和多渠道结构；
- 插件从爆款采集改为账号采集助手。

## 6.3 隐藏但暂不删除

- `/topics` 独立选题雷达；
- `/inspirations` 爆款库；
- 发布指标和数据复盘 UI；
- `/api/articles/[id]/publication`；
- 爆款分析 Prompt 和 API。

## 6.4 明确后置

- 多租户、注册、成员和角色；
- 自动发布和平台草稿箱；
- 发布数据自动采集；
- GitHub 远程知识连接；
- Word / PDF / 图片 / 音视频解析；
- 漂亮综合看板；
- 付费、套餐和运营周报。

---

# 7. 分支与 PR 执行顺序

所有功能 PR 线性从最新 `main` 切出，上一个 PR 合并后再开始下一个。不建议同时在多个长期分支中改动首页和数据结构。

## PR0：建立项目基线

由于远程仓库为空，这一步不是普通 PR，而是首次 `main` 提交与推送。

- 分支：`main`
- 内容：当前可运行代码、PRD、Spec、本审计报告；
- 不包含：`.env.local`、`data/*.local.json`、`.next`；
- 验收：`git status` 无敏感文件，lint 与 build 通过；
- 建议标签：`pre-mvp-realignment-20260720`。

## PR1：收缩产品外壳与默认首页

- 分支：`refactor/p0-product-shell`
- 工作：
  - `/` 改为内容创作入口；
  - 导航收缩为内容创作、当前账号、知识库、草稿历史；
  - 隐藏爆款、发布数据和综合看板入口；
  - 先建立新创作页的步骤骨架和空状态。
- 验收：打开 `/` 立即看到“选题→知识→渠道→生成→审核”，无 P1 必经步骤。

## PR2：统一单账号上下文

- 分支：`feat/p0-account-context`
- 工作：
  - 改造当前账号数据结构；
  - 保留快速手工定位，增加跳过和确认；
  - 创作页自动继承完整 `AccountContext`；
  - 没有定位时给出快速入口，不阻止创作。
- 验收：定位一次后，选题、简报和生成请求均不要求重复填写。

## PR3：本地文件夹与飞书知识库

- 分支：`feat/p0-knowledge-sources`
- 工作：
  - 新建 `/knowledge`；
  - File System Access API 选择目录；
  - IndexedDB 保存目录句柄和 Markdown / TXT 轻量索引；
  - 按需读取用户选中的文件正文；
  - 保留并补完飞书 URL、搜索、预览和错误状态；
  - 文件上传仅作为明确标记的兼容入口。
- 验收：用户选择一个本地目录后能搜索、预览并选择 Markdown / TXT；服务端不出现完整目录副本。

## PR4：选题与统一内容简报

- 分支：`feat/p0-content-brief`
- 工作：
  - 创作页内手工输入选题；
  - 基于当前账号与已选知识推荐选题；
  - 生成并允许确认统一 `ContentBrief`；
  - 引用包含来源 ID、必要片段和用途；
  - 创建 `ContentProject` 并原子保存。
- 验收：不选爆款也能从账号定位和真实知识生成可确认的简报。

## PR5：四渠道独立生成

- 分支：`feat/p0-four-channel-generation`
- 工作：
  - 固定四个 channel enum；
  - 渠道多选和“全部生成”；
  - 统一简报 + 四套独立渠道 Prompt；
  - 分渠道状态、错误和单渠道重试；
  - 一次内容项目保存多个 `ChannelDraft`。
- 验收：一组资料能一次生成公众号、小红书、朋友圈和短视频脚本，且结构不是简单长短变化。

## PR6：AI 审核、人工编辑与导出

- 分支：`feat/p0-review-editor-export`
- 工作：
  - 审核从生成 Prompt 中拆为独立阶段；
  - 事实、风格、平台三类 `ReviewIssue`；
  - 每个渠道可编辑；
  - 支持应用单条建议和重新审核；
  - 复制单渠道、下载 Markdown、保存用户编辑稿。
- 验收：生成内容能在页面内修改，问题可定位，最终文本可直接复制或下载。

## PR7：草稿历史与继续编辑

- 分支：`feat/p0-draft-history`
- 工作：
  - `/drafts` 列表、筛选和详情；
  - 查看简报、引用、四渠道内容和审核状态；
  - 继续编辑；
  - 保留最小修改时间与版本快照；
  - 发布数据界面不进入 P0。
- 验收：刷新页面后草稿仍存在，可重新打开、修改和导出。

## PR8：账号主页采集插件

- 分支：`feat/p0-account-capture-extension`
- 工作：
  - 识别小红书、公众号等账号主页可见结构；
  - 采集账号名、简介、可见粉丝数、内容列表和互动摘要；
  - 增加 `/api/capture/account`；
  - 采集结果进入“预览→用户确认→AI 定位→覆盖当前账号”；
  - 插件可配置内容工厂地址，不再写死 localhost；
  - 收紧 CORS 和访问边界。
- 验收：用户在已登录页面主动点击插件后，无需手工复制大段信息即可生成并保存定位。

## PR9：P0 真实验收与交付说明

- 分支：`test/p0-acceptance`
- 工作：
  - 为每个核心 API 增加最小自动化验证；
  - 补齐主流程浏览器冒烟测试；
  - 用真实本地知识库完成四渠道生成；
  - 用崔总资料完成第一次交付演练；
  - 更新 README 和验收手册；
  - 记录修改量、可发布性和约 3000 元购买意愿。
- 验收：PRD 第 15 章两个验收场景完整跑通。

---

# 8. PR 合并门槛

每个 PR 至少满足：

1. 只解决该 PR 标题对应的一个可验收问题；
2. `npm run lint` 通过；
3. `npm run build` 通过；
4. 新增或改动的 API 有正常路径和错误路径验证；
5. 页面改动在桌面 Chrome 上完成真实操作验证；
6. 不将 P1 功能偷渡进 P0；
7. 如数据结构变化，提供当前 JSON 的小型兼容迁移；
8. 不提交 `.env.local`、AI Key、飞书 Secret 或真实客户知识正文。

---

# 9. 推荐立即执行的下一步

先执行 PR0：

1. 复核 `.gitignore` 和待提交文件；
2. 在 `main` 建立首个基线提交；
3. 推送到 GitHub；
4. 打标签 `pre-mvp-realignment-20260720`；
5. 从 `main` 创建 `refactor/p0-product-shell`；
6. 开始 PR1，只收缩外壳与创作默认首页，暂不同时改 AI 数据结构。

这样可以让后续每个 PR 都小、可回滚、可验收，也能清楚记录产品从旧方向收缩到 MVP 主流程的每一次调整。
