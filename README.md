# 喵语助手

一个中文 PWA 聊天助手，界面结构接近 ChatGPT，后端通过 DeepSeek Chat Completion API 提供回复。

## 配置 DeepSeek API

把 DeepSeek API key 放在本地 `.env.local`，不要把 key 写进代码：

```bash
cp .env.example .env.local
```

然后编辑 `.env.local`：

```bash
DEEPSEEK_API_KEY="你的 key"
```

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。iPhone 访问同一局域网里的服务地址后，可以通过 Safari 分享菜单添加到主屏幕。

生产预览仍可使用：

```bash
npm run build
npm run serve
```

For an always-on Arch Linux laptop deployment, see `docs/arch-linux-deploy.md`.

For GitHub Pages static hosting, see `docs/github-pages.md`. GitHub Pages must call a separate Node proxy; do not put `DEEPSEEK_API_KEY` in any frontend or Pages build variable.

## 模式

- 每日模式：默认使用 `deepseek-v4-flash`，关闭 thinking；只有很复杂的问题才会自动切到 `deepseek-v4-pro`，仍然关闭 thinking。
- 高级模式：固定使用 `deepseek-v4-pro`，始终开启 thinking，默认 `最大思考`，可手动降到 `深度思考`。
- 不满意重答：点助手消息下方的不满意按钮，会用 `v4 pro + 最大思考` 重新回答。

## 离线兜底

如果 API key 未配置、DeepSeek 调用失败或没有网络，应用会显示 API 异常提示，并使用本地预设中文回复继续聊天。

## 图标说明

`public/icon-source.png` 已根据 `assets/source/cat-reference.jpg` 生成，并导出为 PWA 与 iPhone 主屏幕需要的图标尺寸。
