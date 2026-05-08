import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { basename, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAuth, handleCorsPreflight, proxyDeepSeek, sendJson } from "./deepseek-proxy.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = normalize(join(__dirname, ".."));
const distDir = join(rootDir, "dist");
const port = Number(process.env.PORT || 4187);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".ttf", "font/ttf"]
]);

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const rawPath = decodeURIComponent(url.pathname);
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const safePath = normalize(join(distDir, requestedPath));

  if (!safePath.startsWith(distDir)) {
    sendJson(res, 403, { error: "禁止访问" });
    return;
  }

  const filePath = existsSync(safePath) ? safePath : join(distDir, "index.html");
  const ext = extname(filePath);
  const fileName = basename(filePath);
  const cacheControl =
    ext === ".html" || ext === ".webmanifest" || fileName === "sw.js"
      ? "no-cache"
      : "public, max-age=31536000, immutable";
  res.writeHead(200, {
    "content-type": mimeTypes.get(ext) || "application/octet-stream",
    "cache-control": cacheControl
  });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  if (req.url?.startsWith("/api/auth")) {
    if (req.method === "OPTIONS") {
      handleCorsPreflight(req, res);
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "只支持 POST 请求" });
      return;
    }

    await handleAuth(req, res);
    return;
  }

  if (req.url?.startsWith("/api/chat")) {
    if (req.method === "OPTIONS") {
      handleCorsPreflight(req, res);
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "只支持 POST 请求" });
      return;
    }

    await proxyDeepSeek(req, res);
    return;
  }

  if (!existsSync(distDir)) {
    const html = await readFile(join(rootDir, "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  await serveStatic(req, res);
}).listen(port, "0.0.0.0", () => {
  console.log(`喵语助手已启动：http://localhost:${port}`);
});
