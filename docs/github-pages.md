# Legacy GitHub Pages Deployment

This app is now intended to be self-hosted on the Arch Linux laptop. Keep this page only as a legacy reference for static-only GitHub Pages publishing.

GitHub Pages can host the static PWA, but it cannot run the Node API proxy. To avoid leaking `DEEPSEEK_API_KEY`, never add the key to Vite variables, frontend code, GitHub Pages variables, or GitHub Actions secrets for the Pages build.

## Architecture

```text
iPhone or Android browser -> GitHub Pages static app -> separate HTTPS API proxy -> DeepSeek API
```

The key belongs only on the Node proxy host:

```bash
DEEPSEEK_API_KEY="your key"
ALLOWED_ORIGINS="https://YOUR_GITHUB_PAGES_ORIGIN"
APP_LOGIN_USERNAME="your username"
APP_LOGIN_PASSWORD="your app password"
APP_AUTH_SECRET="generate a long random secret"
```

`ALLOWED_ORIGINS` should include only the specific Pages origin that is allowed to call `/api/auth` and `/api/chat`.

The frontend login keeps casual visitors out of the app UI. The proxy login is the real quota protection: once `APP_LOGIN_USERNAME`, `APP_LOGIN_PASSWORD`, and `APP_AUTH_SECRET` are set on the Node host, `/api/chat` requires a valid bearer token from `/api/auth`.

If you use a different proxy host, build the frontend with:

```bash
VITE_API_BASE_URL="https://YOUR_API_HOST" VITE_BASE_PATH=/PipiSeek/ npm run build
```

## Publish

The repository is published with source code on `main` and static Pages output on `gh-pages`.

Build locally and publish the `dist` folder to the `gh-pages` branch:

```bash
VITE_BASE_PATH=/PipiSeek/ npm run build
```

Configure GitHub Pages to deploy from the `gh-pages` branch root. No GitHub Action or Pages secret should contain `DEEPSEEK_API_KEY`.

## iPhone

Open the Pages URL in Safari, then use Share -> Add to Home Screen.

## Android / OnePlus 12

Open the Pages URL in Chrome, then use the three-dot menu -> Install app. If Chrome only shows Add to Home screen, use that option; it still installs the PWA shell with the app icon. Allow microphone access when voice input is first used.
