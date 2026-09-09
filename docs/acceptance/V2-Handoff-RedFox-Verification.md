# V2 创作承接与 RedFox 验收

日期：2026-09-09

## 本轮修复

- 去除创作页标题的重复 URI 解码，含百分号的标题可正常打开。
- 选题通过服务端读取来源内容，进入简报、项目和渠道生成；外部参考与知识库事实分开。
- 打开创作页不改变选题状态，实际保存项目后才进入已使用列表，可追溯项目。
- SQLite 改为按需连接、串行初始化迁移，避免空数据库构建时并发锁库。
- 搜索错误与收藏错误显式展示；热榜、热搜、聚合热点、趋势和对标账号改为真实接口调用链，不承诺后台自动轮询或自动拆解。

## RedFox 边界

已按官方文档修正请求及字段映射：

| 能力 | 接口 | 验证状态 |
| --- | --- | --- |
| 小红书搜索 | xhs/ability/searchWork | 官方格式模拟联调通过 |
| 抖音搜索 | dyData/searchArticle | 官方格式模拟联调通过 |
| 公众号搜索 | gzhData/searchArticle | 官方格式模拟联调通过 |
| 视频号搜索 | sphAllData/searchWork | 官方格式模拟联调通过 |
| 小红书作品榜 | GET cozeSkill/getXhsCozeSkillDataOne | 官方格式模拟联调通过 |
| 抖音作品榜 | dy/search/likesRank | 官方格式模拟联调通过 |
| 公众号热门文章 | gzh/search/hotArticle | 官方格式模拟联调通过 |
| 七平台热搜与趋势 | hotSpot/getListByPlatformWithKeyword | 官方格式模拟联调通过 |
| 聚合热点 | hotKeyword/list | 官方格式模拟联调通过 |
| 小红书、抖音、公众号账号与作品 | 各平台 queryAccountDetail/queryUser、queryWorkList | 官方格式模拟联调通过 |

使用 REDFOX_API_KEY 请求头；REDFOX_BASE_URL 优先于 REDFOX_HOST。
已覆盖业务错误、缓存、稳定去重 ID、零指标、来源链接与数据库持久化。
收藏保留已有正文与分析，标记 API 来源；未知数据不伪造为零。账号刷新失败保留旧快照，停止追踪不删除已收藏内容。
趋势比较两个相邻、等长且不含今天的窗口，仅表示返回热搜样本平均热度，不代表全网搜索量。暂不提供视频号作品榜及账号追踪。
检查时本地未配置 RedFox Key，因此未执行真实付费请求，接口权限、额度和真实返回兼容性仍待验证。

官方依据：

- https://doc.redfox.hk/474468723e0
- https://t.redfox.hk/apis/douyin/774OBKK0/
- https://t.redfox.hk/apis/gongzhonghao/PW97QFBS/
- https://redfox.hk/story/web/api/doc/detail/no/E7G00COY
- https://redfox.hk/story/web/api/doc/detail/no/AEA6YE0J
- https://redfox.hk/story/web/api/doc/detail/no/W94P1QH1
- https://redfox.hk/story/web/api/doc/detail/no/9Y4EX7RW
- https://github.com/redfox-data/redfox-community/blob/main/skills/douyin-daily-hot/references/api-config.md
- https://github.com/redfox-data/redfox-community/blob/main/skills/wechat-search/references/gzh_trend_data_format.md

## 自动化验收

`npm run test:acceptance` 通过：ESLint 无错误（2 个既有未使用变量警告）、插件回归 7 项、V1 API 回归 21 项、生产构建及 V2 隔离测试 11 项（含父测试）。
V2 测试使用临时数据库与模拟 AI/RedFox，覆盖搜索→选题→简报→项目→四渠道生成、各新增接口、参数与业务错误、缓存、账号失败保护及重启持久化。
浏览器在独立临时环境验证：作品榜收藏、热搜、聚合关键词跳转搜索、视频号搜索、趋势对比、添加与刷新对标账号、首页导航。页面无控制台错误；未修改真实内容数据。
未进行真实 RedFox 账号权限/额度联调或真实 AI 内容质量验收。

## 交付位置

分支：fix/v2-creation-handoff；工作目录：contentfactory-v2-handoff。
用户批准的原 V2 升级已建立基线提交 `78f5580`。本轮修改在此基线上通过 PR 交付 main；用户手写的 `V1-7-Day-Real-Use-Log.md` 不纳入提交，保持原样。
