import { existsSync, readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEEPSEEK_BASE_URL } from "./deepseek-config.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const shellEnvKeys = new Set(Object.keys(process.env));
const maxRequestBodyBytes = Number(process.env.MAX_CHAT_REQUEST_BYTES || 4_000_000);

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

function readJsonBody(req, maxBytes = maxRequestBodyBytes) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > maxBytes) {
        tooLarge = true;
        body = "";
      }
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(httpError(`请求内容过大，请减少历史上下文或附件后重试。当前限制约 ${Math.round(maxBytes / 1024 / 1024)} MB。`, 413));
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON 格式不正确"));
      }
    });
    req.on("error", reject);
  });
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
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

  if (isSameOriginRequest(req, origin)) return true;

  const allowedOrigins = configuredAllowedOrigins();
  if (!allowedOrigins.includes(origin)) {
    sendJson(res, 403, { error: "当前来源没有被允许调用 API。请配置 ALLOWED_ORIGINS。" });
    return false;
  }

  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  res.setHeader("vary", "Origin");
  return true;
}

function isSameOriginRequest(req, origin) {
  try {
    const originUrl = new URL(origin);
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
    return Boolean(host && originUrl.host === host);
  } catch {
    return false;
  }
}

export function handleCorsPreflight(req, res) {
  if (!applyCors(req, res)) return;
  res.writeHead(204, {
    "cache-control": "no-store"
  });
  res.end();
}

export async function handleAuth(req, res) {
  if (!applyCors(req, res)) return;

  const configuredUsername = process.env.APP_LOGIN_USERNAME?.trim();
  const configuredPassword = process.env.APP_LOGIN_PASSWORD;
  const authSecret = process.env.APP_AUTH_SECRET?.trim();

  if (!configuredUsername || !configuredPassword || !authSecret) {
    sendJson(res, 503, { error: "登录服务尚未配置。" });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message });
    return;
  }

  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!safeEqual(username, configuredUsername) || !safeEqual(password, configuredPassword)) {
    sendJson(res, 401, { error: "用户名或密码不正确" });
    return;
  }

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  sendJson(res, 200, {
    token: signAuthToken({ username, expiresAt }, authSecret),
    expiresAt
  });
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
  if (!requireAuth(req, res)) return;

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message });
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
  const upstreamController = new AbortController();
  req.on("close", () => upstreamController.abort());
  try {
    upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      signal: upstreamController.signal,
      body: JSON.stringify(buildDeepSeekBody(payload))
    });
  } catch (error) {
    if (upstreamController.signal.aborted) return;
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
  res.flushHeaders?.();

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

function requireAuth(req, res) {
  const configuredUsername = process.env.APP_LOGIN_USERNAME?.trim();
  const configuredPassword = process.env.APP_LOGIN_PASSWORD;
  const authSecret = process.env.APP_AUTH_SECRET?.trim();
  if (!configuredUsername || !configuredPassword || !authSecret) return true;

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const payload = verifyAuthToken(token, authSecret);
  if (!payload || payload.username !== configuredUsername || payload.expiresAt <= Date.now()) {
    sendJson(res, 401, { error: "请先登录。" });
    return false;
  }

  return true;
}

function signAuthToken(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token, secret) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
