import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEEPSEEK_BASE_URL } from "./deepseek-config.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const shellEnvKeys = new Set(Object.keys(process.env));

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local");

function loadLocalEnvFile(fileName) {
  const filePath = join(rootDir, fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (shellEnvKeys.has(key)) continue;
    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("请求内容过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON 格式不正确"));
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function configuredAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function applyCors(req, res) {
  const origin = req.headers.origin?.replace(/\/+$/, "");
  if (!origin) return true;

  const allowedOrigins = configuredAllowedOrigins();
  if (!allowedOrigins.includes(origin)) {
    sendJson(res, 403, { error: "当前来源没有被允许调用 API。请配置 ALLOWED_ORIGINS。" });
    return false;
  }

  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("vary", "Origin");
  return true;
}

export function handleCorsPreflight(req, res) {
  if (!applyCors(req, res)) return;
  res.writeHead(204, {
    "cache-control": "no-store"
  });
  res.end();
}

function buildDeepSeekBody(payload) {
  const model = payload?.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash";
  const thinkingEnabled = Boolean(payload?.thinkingEnabled);
  const reasoningEffort = payload?.reasoningEffort === "max" ? "max" : "high";

  return {
    model,
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    stream: true,
    thinking: {
      type: thinkingEnabled ? "enabled" : "disabled"
    },
    ...(thinkingEnabled ? { reasoning_effort: reasoningEffort } : {})
  };
}

export async function proxyDeepSeek(req, res) {
  if (!applyCors(req, res)) return;

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 503, {
      error: "DeepSeek API key 尚未配置。请在 .env.local 或环境变量 DEEPSEEK_API_KEY 中设置。",
      fallback: true
    });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(buildDeepSeekBody(payload))
    });
  } catch (error) {
    sendJson(res, 502, {
      error: `DeepSeek 网络连接失败：${error instanceof Error ? error.message : "未知错误"}`,
      fallback: true
    });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    sendJson(res, upstream.status || 502, {
      error: `DeepSeek API 返回异常：${detail || upstream.statusText}`,
      fallback: true
    });
    return;
  }

  res.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-accel-buffering": "no"
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const dataLines = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());

        for (const data of dataLines) {
          if (!data || data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const text = chunk?.choices?.[0]?.delta?.content || "";
            if (text) res.write(text);
          } catch {
            continue;
          }
        }
      }
    }
  } catch {
    res.write("\n\n[连接中断]");
  } finally {
    res.end();
  }
}
