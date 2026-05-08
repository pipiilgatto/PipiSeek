# Arch Linux Self-Hosting

This is the recommended production setup. The Arch laptop runs one Node server that serves both:

- the built app at `/`
- the private API proxy at `/api/auth` and `/api/chat`

Your phone opens one HTTPS hostname:

```text
https://YOUR_APP_HOSTNAME/
https://YOUR_APP_HOSTNAME/api/auth
https://YOUR_APP_HOSTNAME/api/chat
```

Cloudflare Tunnel forwards that hostname to the Arch laptop:

```text
Cloudflare Tunnel -> http://localhost:4187
```

Because the app and API are same-origin, do not set `VITE_API_BASE_URL` for this setup.

## Short Answer

Yes, clone the public repo directly on the Arch laptop:

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
git clone https://github.com/pipiilgatto/PipiSeek.git /opt/miaoyu-assistant
cd /opt/miaoyu-assistant
```

Then create `.env.local` on the Arch laptop only, build the app, run the systemd service, and point your Cloudflare Tunnel hostname to `http://localhost:4187`.

## 1. Install System Packages

```bash
sudo pacman -Syu
sudo pacman -S --needed git nodejs npm openssl
```

Install `cloudflared`. The most direct Arch-compatible path is the Linux binary:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo install -m 0755 cloudflared /usr/local/bin/cloudflared
cloudflared --version
```

## 2. Clone Or Update The App

First install:

```bash
git clone https://github.com/pipiilgatto/PipiSeek.git /opt/miaoyu-assistant
cd /opt/miaoyu-assistant
```

Later updates:

```bash
cd /opt/miaoyu-assistant
git pull
```

## 3. Create Local Secrets

Create the server-only env file:

```bash
cd /opt/miaoyu-assistant
cp .env.example .env.local
openssl rand -hex 32
nano .env.local
```

Use this shape:

```bash
DEEPSEEK_API_KEY="your DeepSeek key"
ALLOWED_ORIGINS=""
APP_LOGIN_USERNAME="pipi"
APP_LOGIN_PASSWORD="your private app password"
APP_AUTH_SECRET="paste the openssl rand output here"
VITE_API_BASE_URL=""
```

Important:

- `.env.local` must stay only on the Arch laptop.
- `.env.local` is ignored by git.
- `ALLOWED_ORIGINS=""` is correct when the browser opens the app and calls the API from the same hostname.
- `VITE_API_BASE_URL=""` keeps frontend requests relative, so the app calls `/api/auth` and `/api/chat` on the same hostname.

## 4. Build And Test Locally

```bash
cd /opt/miaoyu-assistant
npm ci
npm run build
npm run serve
```

In another terminal:

```bash
curl -i http://localhost:4187/
curl -i -X POST http://localhost:4187/api/auth \
  -H 'content-type: application/json' \
  --data '{"username":"pipi","password":"your private app password"}'
```

If login returns a token, the app server is working. Stop the manual server with `Ctrl-C`.

## 5. Run The App With Systemd

```bash
cd /opt/miaoyu-assistant
sed "s/YOUR_LINUX_USER/$USER/g" deploy/systemd/miaoyu-assistant.service | sudo tee /etc/systemd/system/miaoyu-assistant.service
sudo systemctl daemon-reload
sudo systemctl enable --now miaoyu-assistant
sudo systemctl status miaoyu-assistant
```

Useful checks:

```bash
curl -i http://localhost:4187/
sudo journalctl -u miaoyu-assistant -f
sudo systemctl restart miaoyu-assistant
```

## 6. Point Cloudflare Tunnel To The Same Server

Use one public hostname for both the app and the API.

```text
Public hostname: YOUR_APP_HOSTNAME
Tunnel service: http://localhost:4187
```

If you already have a hostname on Cloudflare Tunnel, move that hostname so it points to the Arch laptop's tunnel. Do not leave the old Mac tunnel running for the same hostname unless you intentionally want both machines to serve the app.

### Dashboard Tunnel

If you manage the tunnel in the Cloudflare Zero Trust dashboard:

1. Open Zero Trust -> Networks -> Tunnels.
2. Select your tunnel or create a new one.
3. Add a public hostname.
4. Set the hostname to `YOUR_APP_HOSTNAME`.
5. Set service type to `HTTP`.
6. Set service URL to `localhost:4187`.
7. Install the connector on Arch with the token command Cloudflare shows.

The command usually looks like:

```bash
sudo cloudflared service install YOUR_TUNNEL_TOKEN
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

### CLI Tunnel

If you manage the tunnel from the CLI:

```bash
cloudflared tunnel login
cloudflared tunnel create miaoyu-assistant
cloudflared tunnel route dns miaoyu-assistant YOUR_APP_HOSTNAME
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_LINUX_USER/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: YOUR_APP_HOSTNAME
    service: http://localhost:4187
  - service: http_status:404
```

Then install the tunnel service:

```bash
sudo cloudflared --config /home/YOUR_LINUX_USER/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

## 7. Final Phone Test

Open this on each phone:

```text
https://YOUR_APP_HOSTNAME
```

Then:

- iPhone: Safari -> Share -> Add to Home Screen.
- Android / OnePlus 12: Chrome -> three-dot menu -> Install app or Add to Home screen.

The address bar should stay on `https://YOUR_APP_HOSTNAME`. Chat requests should go to `https://YOUR_APP_HOSTNAME/api/chat`, not to GitHub Pages and not to any separate API hostname.

## 8. Updating Later

```bash
cd /opt/miaoyu-assistant
git pull
npm ci
npm run build
sudo systemctl restart miaoyu-assistant
```

The DeepSeek key and app password stay in `.env.local`, so `git pull` will not overwrite them.

## Blank Page Troubleshooting

If the domain opens but shows a blank page, check whether the production build exists:

```bash
cd /opt/miaoyu-assistant
ls dist/index.html
curl -i http://127.0.0.1:4187/
```

If `dist/index.html` is missing, build and restart:

```bash
npm ci
npm run build
sudo systemctl restart miaoyu-assistant
```

The public HTML should reference `/assets/...js`. If it references `/src/main.tsx` or contains `%BASE_URL%`, the app is serving the unbuilt development HTML.
