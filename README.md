# 喵语助手

一个中文私人 PWA 聊天助手。推荐部署方式是把前端静态文件和 `/api` 代理都放在自己的 Arch Linux 笔记本上运行，手机通过 Cloudflare Tunnel 的 HTTPS 地址访问。

Arch 笔记本上可以直接 clone 公开仓库：

```bash
git clone https://github.com/pipiilgatto/PipiSeek.git /opt/miaoyu-assistant
cd /opt/miaoyu-assistant
```

完整步骤见 `docs/arch-linux-deploy.md`。

## 配置服务端

把 DeepSeek API key 和登录配置放在服务端 `.env.local`，不要把 key 或明文密码写进前端代码：

```bash
cp .env.example .env.local
```

然后编辑 `.env.local`：

```bash
DEEPSEEK_API_KEY="你的 key"
APP_LOGIN_USERNAME="你的用户名"
APP_LOGIN_PASSWORD="你的访问密码"
APP_AUTH_SECRET="一段足够长的随机字符串"
```

默认构建会使用同源 `/api`，也就是浏览器打开哪个 HTTPS 域名，聊天请求就发到同一个域名的 `/api/auth` 和 `/api/chat`。这适合完整自托管，不需要 GitHub Pages。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。

应用通过服务端代理调用 DeepSeek；不要把 DeepSeek key、代理域名或明文密码写进前端代码和公开文档。

生产预览仍可使用：

```bash
npm run build
npm run serve
```

GitHub Pages 只适合临时静态托管；长期使用建议让 Arch 笔记本同时托管前端和 API。

## 模式

- 每日模式：日常任务、写作、翻译、沟通与轻量分析。默认 `deepseek-v4-flash`，关闭 thinking；复杂问题自动切到 `deepseek-v4-pro`，仍关闭 thinking。
- 数理模式：逻辑、数学、物理、证明和复杂计算。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `high`。
- 编程模式：代码、调试、架构、agent 与 app 开发。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `max`。
- 三个模式各自保存独立对话历史；左侧按模式文件夹分组。
- 输入框支持上传图片、文本和常见文件作为补充材料；可解析的小文本会随问题提交，压缩后的图片会作为视觉材料提交。

## 手机安装

iPhone：用 Safari 打开你的 Cloudflare HTTPS 地址，点 Share，再点 Add to Home Screen。

Android / OnePlus 12：用 Chrome 打开你的 Cloudflare HTTPS 地址，点右上角三点菜单，再点 Install app 或 Add to Home screen。首次使用语音输入时允许麦克风权限；如果 Chrome 没显示安装入口，刷新一次页面或清除该站点的旧缓存后再打开。

## 离线兜底

如果 API key 未配置、DeepSeek 调用失败或没有网络，应用会显示 API 异常提示，并使用本地预设中文回复继续聊天。

## 图标说明

`public/icon-source.png` 已根据 `assets/source/cat-reference.jpg` 生成，并导出为 PWA 与 iPhone 主屏幕需要的图标尺寸。
