# GitHub Pages Deployment

GitHub Pages hosts the static PWA, but it cannot run the Node API proxy. To avoid leaking `DEEPSEEK_API_KEY`, never add the key to Vite variables, frontend code, GitHub Pages variables, or GitHub Actions secrets for the Pages build.

## Architecture

```text
iPhone Safari -> GitHub Pages static app -> https://pipicat.xin API proxy -> DeepSeek API
```

The key belongs only on the Node proxy host:

```bash
DEEPSEEK_API_KEY="your key"
ALLOWED_ORIGINS="https://pipiilgatto.github.io"
```

`ALLOWED_ORIGINS` should include the GitHub Pages origin that is allowed to call `/api/chat`. This is browser-side protection, not strong authentication, so keep the backend URL private enough for your use case or put it behind Cloudflare Access if you need stronger access control.

The frontend uses `https://pipicat.xin/api/chat` as the only remote API endpoint.

## Publish

The repository is published with source code on `main` and static Pages output on `gh-pages`.

Build locally and publish the `dist` folder to the `gh-pages` branch:

```bash
VITE_BASE_PATH=/PipiSeek/ npm run build
```

Configure GitHub Pages to deploy from the `gh-pages` branch root. No GitHub Action or Pages secret should contain `DEEPSEEK_API_KEY`.

## iPhone

Open the Pages URL in Safari:

```text
https://pipiilgatto.github.io/PipiSeek/
```

Then use Share -> Add to Home Screen.
