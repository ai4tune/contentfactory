# P0 Modules

P0 业务代码按模块放在这个目录，页面和 Route Handler 只做薄集成。

固定模块：

- `positioning`：当前账号、插件采集负载和定位分析；
- `knowledge`：本地文件夹、知识检索和证据选择；
- `topics`：创作页内的最小选题能力；
- `content`：内容项目、统一简报和四渠道生成；
- `reviews`：事实、风格和平台审核；
- `drafts`：草稿历史、修改版本和导出；
- `integrations/feishu`：飞书知识连接。

详细所有权、稳定路由和 PR 顺序见：

`docs/development/P0-Code-Ownership-and-Branch-Strategy.md`

不要预先创建空的模块文件。各 PR 只在实现对应能力时创建所需目录和文件。

