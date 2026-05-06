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

For an always-on Arch Linux laptop deployment, see `docs/arch-linux-deploy.md`.


## 模式

- 每日模式：日常任务、写作、翻译、沟通与轻量分析。默认 `deepseek-v4-flash`，关闭 thinking；复杂问题自动切到 `deepseek-v4-pro`，仍关闭 thinking。
- 数理模式：逻辑、数学、物理、证明和复杂计算。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `high`。
- 编程模式：代码、调试、架构、agent 与 app 开发。固定 `deepseek-v4-pro`，开启 thinking，reasoning effort 为 `max`。
- 三个模式各自保存独立对话历史；左侧按模式文件夹分组。
- 输入框支持上传图片、文本和常见文件作为补充材料；可解析的小文本会随问题提交，压缩后的图片会作为视觉材料提交。

## 离线兜底

如果 API key 未配置、DeepSeek 调用失败或没有网络，应用会显示 API 异常提示，并使用本地预设中文回复继续聊天。

## 图标说明

`public/icon-source.png` 已根据 `assets/source/cat-reference.jpg` 生成，并导出为 PWA 与 iPhone 主屏幕需要的图标尺寸。
