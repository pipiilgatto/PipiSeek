# Arch Linux Remote Deployment

Use the Arch laptop as the always-on origin server. Run the built Node server on `localhost:4187`, then expose it through Cloudflare Tunnel. Do not run Vite dev server for the shared iPhone app.

## 1. Prepare the laptop

```bash
sudo pacman -Syu
sudo pacman -S git nodejs npm
```

Install `cloudflared` using Cloudflare's Linux download instructions or your preferred Arch/AUR package. For an x86-64 Arch laptop, the direct binary path is:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo install -m 0755 cloudflared /usr/local/bin/cloudflared
cloudflared --version
```

## 2. Copy the app

Recommended target:

```bash
sudo mkdir -p /opt/miaoyu-assistant
sudo chown "$USER":"$USER" /opt/miaoyu-assistant
```

Copy the project from your Mac to the Arch laptop. If you use `rsync`, do not copy `node_modules`, build artifacts, or local caches:

```bash
rsync -av --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .npm-cache \
  /path/to/PipiSeek/ user@ARCH_LAPTOP_IP:/opt/miaoyu-assistant/
```

## 3. Configure the key on the laptop

On the Arch laptop:

```bash
cd /opt/miaoyu-assistant
cp .env.example .env.local
nano .env.local
```

Set:

```bash
DEEPSEEK_API_KEY="your key"
```

Keep `.env.local` only on the laptop. It is ignored by git.

## 4. Build and test locally

```bash
cd /opt/miaoyu-assistant
npm ci
npm run build
npm run serve
```

In another SSH session:

```bash
curl -i http://localhost:4187/
curl -i -X POST http://localhost:4187/api/chat \
  -H 'content-type: application/json' \
  --data '{"model":"deepseek-v4-flash","thinkingEnabled":false,"messages":[{"role":"user","content":"只回复 OK"}]}'
```

Stop the manual server with `Ctrl-C` after testing.

## 5. Install as a systemd service

Edit the template first:

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

## 6. Expose with Cloudflare Tunnel

For a quick temporary tunnel:

```bash
cloudflared tunnel --url http://localhost:4187
```

For daily use, create a named tunnel in Cloudflare Zero Trust and route a stable hostname, for example:

```text
miaoyu.your-domain.com -> http://localhost:4187
```

Then install cloudflared as a Linux service using the command shown in the Cloudflare dashboard. If you are using a locally managed tunnel config, Cloudflare documents that Linux service installs expect config under `$HOME/.cloudflared/config.yml`, and when using `sudo` you may need to pass the config path explicitly:

```bash
sudo cloudflared --config /home/YOUR_LINUX_USER/.cloudflared/config.yml service install
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

## 7. iPhone install

Open the stable HTTPS hostname in Safari, then:

1. Tap Share.
2. Tap Add to Home Screen.
3. Add it.

If you switch from quick tunnel to a stable hostname, delete the old Home Screen app and add the stable URL again.
