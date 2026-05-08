# Arch Linux Self-Hosting

Use the Arch laptop as the only production host. The laptop serves both:

- the built PWA from `dist`
- the private API endpoints `/api/auth` and `/api/chat`

Phones access the app through one Cloudflare Tunnel HTTPS hostname. Do not use GitHub Pages for the shared app.

## 1. Prepare Arch

```bash
sudo pacman -Syu
sudo pacman -S git nodejs npm openssl rsync
```

Install `cloudflared` from Cloudflare's Linux package instructions, your package manager, or the AUR. For a quick binary install on x86-64 Linux:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo install -m 0755 cloudflared /usr/local/bin/cloudflared
cloudflared --version
```

## 2. Copy The Project

Recommended target:

```bash
sudo mkdir -p /opt/miaoyu-assistant
sudo chown "$USER":"$USER" /opt/miaoyu-assistant
```

From the Mac:

```bash
rsync -av --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .npm-cache \
  --exclude .env \
  --exclude .env.local \
  /path/to/PipiSeek/ user@ARCH_LAPTOP_IP:/opt/miaoyu-assistant/
```

## 3. Configure Secrets

On the Arch laptop:

```bash
cd /opt/miaoyu-assistant
cp .env.example .env.local
nano .env.local
```

Set:

```bash
DEEPSEEK_API_KEY="your DeepSeek key"
ALLOWED_ORIGINS=""
APP_LOGIN_USERNAME="pipi"
APP_LOGIN_PASSWORD="your private app password"
APP_AUTH_SECRET="replace with output from openssl rand -hex 32"
VITE_API_BASE_URL=""
```

Keep `.env.local` only on the laptop. It is ignored by git. Generate the auth secret with:

```bash
openssl rand -hex 32
```

`ALLOWED_ORIGINS` can stay empty for this self-hosted setup because the frontend and API are same-origin. Only set it if another separate website must call this API.

## 4. Build And Test

```bash
cd /opt/miaoyu-assistant
npm ci
npm run build
npm run serve
```

In another SSH session:

```bash
curl -i http://localhost:4187/
curl -i -X POST http://localhost:4187/api/auth \
  -H 'content-type: application/json' \
  --data '{"username":"pipi","password":"your private app password"}'
```

Use the returned token:

```bash
curl -i -X POST http://localhost:4187/api/chat \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_TOKEN' \
  --data '{"model":"deepseek-v4-flash","thinkingEnabled":false,"messages":[{"role":"user","content":"只回复 OK"}]}'
```

Stop the manual server with `Ctrl-C` after testing.

## 5. Run As A Systemd Service

```bash
cd /opt/miaoyu-assistant
sed "s/YOUR_LINUX_USER/$USER/g" deploy/systemd/miaoyu-assistant.service | sudo tee /etc/systemd/system/miaoyu-assistant.service
sudo systemctl daemon-reload
sudo systemctl enable --now miaoyu-assistant
sudo systemctl status miaoyu-assistant
```

Useful commands:

```bash
sudo journalctl -u miaoyu-assistant -f
sudo systemctl restart miaoyu-assistant
```

## 6. Expose With Cloudflare Tunnel

Temporary test tunnel:

```bash
cloudflared tunnel --url http://localhost:4187
```

Open the generated `https://...trycloudflare.com` URL on a phone and verify login/chat. For permanent use, create a named Cloudflare Tunnel and route your chosen hostname to:

```text
http://localhost:4187
```

CLI flow:

```bash
cloudflared tunnel login
cloudflared tunnel create miaoyu-assistant
cloudflared tunnel list
cloudflared tunnel route dns miaoyu-assistant YOUR_APP_HOSTNAME
```

If you use a locally managed tunnel config, the ingress should be:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_LINUX_USER/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: YOUR_APP_HOSTNAME
    service: http://localhost:4187
  - service: http_status:404
```

Then install and start the tunnel service:

```bash
sudo cloudflared --config /home/YOUR_LINUX_USER/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

## 7. Install On Phones

iPhone:

1. Open `https://YOUR_APP_HOSTNAME` in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open the new Home Screen app and log in.

Android / OnePlus 12:

1. Open `https://YOUR_APP_HOSTNAME` in Chrome.
2. Tap the three-dot menu.
3. Tap Install app or Add to Home screen.
4. Allow microphone permission when voice input is first used.

If you change the hostname, delete the old Home Screen app and install the new URL again.

## 8. Update Later

From the Mac, repeat the `rsync` command, then on Arch:

```bash
cd /opt/miaoyu-assistant
npm ci
npm run build
sudo systemctl restart miaoyu-assistant
```

The DeepSeek key stays on the laptop throughout this process.
