# 内容工厂账号采集助手

Manifest V3 Chrome 扩展，用于主动采集当前已打开账号页中的可见信息，生成 AI 账号定位预览，并在用户确认后覆盖内容工厂的当前账号。

## 安装

1. 在 Chrome 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `extensions/contentfactory-capture`。

## 使用

1. 启动内容工厂，默认地址为 `http://localhost:3000`。
2. 打开已登录后能看到的小红书、公众号或其他账号主页/创作者后台。
3. 点击扩展的“采集当前账号页”。
4. 检查账号名称、简介、粉丝数、内容列表和互动摘要。
5. 确认采集结果后生成 AI 定位预览。
6. 修改定位预览，再确认覆盖当前账号。

扩展只读取当前页面 DOM 中已经可见的文本和链接，不会读取密码、绕过登录、解决验证码或在后台批量爬取。

## 连接独立部署

在扩展的“连接设置”中填写内容工厂地址，点击“保存并授权该地址”。远程部署还必须选择一种服务端授权方式：

- 在 `CAPTURE_ALLOWED_ORIGINS` 中配置扩展的精确 Origin，例如 `chrome-extension://abcdefghijklmnopabcdefghijklmnop`；
- 或设置 `CONTENT_FACTORY_CAPTURE_TOKEN`，并将同一访问码填入扩展。

多个允许的 Origin 使用英文逗号分隔。服务端不使用通配 CORS Origin。
