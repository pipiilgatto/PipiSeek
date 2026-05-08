import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

const configuredBase = process.env.VITE_BASE_PATH || "/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "deepseek-dev-api",
      configureServer(server) {
        server.middlewares.use(async (req: any, res: any, next: () => void) => {
          if (req.url?.startsWith("/api/auth")) {
            if (req.method !== "POST") {
              next();
              return;
            }

            try {
              // @ts-ignore: runtime-only Node ESM module used by the Vite dev server.
              const { handleAuth } = await import("./server/deepseek-proxy.mjs");
              await handleAuth(req, res);
            } catch (error) {
              res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "本地登录代理启动失败" }));
            }
            return;
          }

          if (!req.url?.startsWith("/api/chat") || req.method !== "POST") {
            next();
            return;
          }

          try {
            // @ts-ignore: runtime-only Node ESM module used by the Vite dev server.
            const { proxyDeepSeek } = await import("./server/deepseek-proxy.mjs");
            await proxyDeepSeek(req, res);
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : "本地 API 代理启动失败" }));
          }
        });
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [".trycloudflare.com"]
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
