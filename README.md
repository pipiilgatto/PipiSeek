# 喵语助手

一个中文 PWA 聊天助手，界面结构接近 ChatGPT，后端通过 DeepSeek Chat Completion API 提供回复。

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

前端 GitHub Pages 版本会显示登录页。真正防止别人消耗 DeepSeek 配额的是服务端 `APP_LOGIN_*` 配置；配置后 `/api/chat` 只接受登录后拿到的 token。

如果你改用自己的代理域名，构建前设置：

```bash
VITE_API_BASE_URL="https://YOUR_API_HOST"
```

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。远程 iPhone 访问推荐使用 GitHub Pages：

```text
https://pipiilgatto.github.io/PipiSeek/
```

应用通过服务端代理调用 DeepSeek；不要把 DeepSeek key、代理域名或明文密码写进前端代码和公开文档。

生产预览仍可使用：

```bash
npm run build
npm run serve
```

For an always-on Arch Linux laptop deployment, see `docs/arch-linux-deploy.md`.

For GitHub Pages static hosting, see `docs/github-pages.md`. GitHub Pages must call a separate Node proxy; do not put `DEEPSEEK_API_KEY` in any frontend or Pages build variable.

## 模式

- 每日模式：日常任务、写作、翻译、沟通与轻量分析。默认 `deepseek-v4-flash`，关闭 thinking；复杂问题自动切到 `deepseek-v4-pro`，仍关闭 thinking。
- 数理模式：逻辑、数学、物理、证明和复杂计算。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `high`。
- 编程模式：代码、调试、架构、agent 与 app 开发。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `max`。
- 三个模式各自保存独立对话历史；左侧按模式文件夹分组。
- 输入框支持上传图片、文本和常见文件作为补充材料；可解析的小文本会随问题提交，压缩后的图片会作为视觉材料提交。

## 手机安装

iPhone：用 Safari 打开 GitHub Pages 地址，点 Share，再点 Add to Home Screen。

Android / OnePlus 12：用 Chrome 打开 GitHub Pages 地址，点右上角三点菜单，再点 Install app 或 Add to Home screen。首次使用语音输入时允许麦克风权限；如果 Chrome 没显示安装入口，刷新一次页面或清除该站点的旧缓存后再打开。

## 离线兜底

如果 API key 未配置、DeepSeek 调用失败或没有网络，应用会显示 API 异常提示，并使用本地预设中文回复继续聊天。

## 图标说明

`public/icon-source.png` 已根据 `assets/source/cat-reference.jpg` 生成，并导出为 PWA 与 iPhone 主屏幕需要的图标尺寸。
