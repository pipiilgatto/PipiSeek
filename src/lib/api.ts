import { getOfflineFallback } from "../data/fallbacks";
import type { ChatMessage, ChatRoute } from "../types";

interface SendChatOptions {
  messages: ChatMessage[];
  route: ChatRoute;
  apiBaseUrl?: string;
  onChunk: (chunk: string) => void;
}

export async function streamAssistantReply({ messages, route, apiBaseUrl, onChunk }: SendChatOptions) {
  const response = await fetch(apiEndpoint("/api/chat", apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: route.model,
      thinkingEnabled: route.thinkingEnabled,
      reasoningEffort: route.reasoningEffort,
      messages: [
        {
          role: "system",
          content:
            "你是喵语助手，一个中文私人聊天助手。回答要自然、具体、可靠。每次语音朗读会由客户端补上“喵～”，文本回答不需要每句都卖萌。"
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      ]
    })
  });

  if (!response.ok || !response.body) {
    let errorText = "API 调用失败";
    try {
      const errorPayload = await response.json();
      errorText = errorPayload.error || errorText;
    } catch {
      errorText = response.statusText || errorText;
    }
    throw new Error(errorText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(chunk);
  }

  return fullText.trim();
}

export function fallbackReply(prompt: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "网络不可用或服务没有响应";
  return getOfflineFallback(prompt, reason);
}

function apiEndpoint(path: string, runtimeBase?: string) {
  const configuredBase = runtimeBase?.trim() || import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configuredBase) return path;
  return `${configuredBase.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
