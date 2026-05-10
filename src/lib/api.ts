import { getOfflineFallback } from "../data/fallbacks";
import type { Attachment, ChatMessage, ChatRoute } from "../types";
import type { AuthSession } from "./auth";
import { apiEndpoint } from "./config";

const maxImageParts = 2;
const maxImagePartChars = 760_000;
const requestTimeoutMsByMode = {
  daily: 55_000,
  math: 90_000,
  coding: 90_000
} satisfies Record<ChatRoute["mode"], number>;

const contextPolicies = {
  daily: {
    maxRecentMessages: 18,
    maxRecentChars: 18_000,
    maxOlderDigestChars: 4_800,
    maxRecentMessageChars: 3_600,
    maxRecentAttachmentTextChars: 800,
    maxLatestAttachmentTextChars: 10_000
  },
  math: {
    maxRecentMessages: 14,
    maxRecentChars: 22_000,
    maxOlderDigestChars: 6_200,
    maxRecentMessageChars: 5_000,
    maxRecentAttachmentTextChars: 1_000,
    maxLatestAttachmentTextChars: 10_000
  },
  coding: {
    maxRecentMessages: 16,
    maxRecentChars: 26_000,
    maxOlderDigestChars: 7_200,
    maxRecentMessageChars: 7_000,
    maxRecentAttachmentTextChars: 1_400,
    maxLatestAttachmentTextChars: 10_000
  }
} satisfies Record<
  ChatRoute["mode"],
  {
    maxRecentMessages: number;
    maxRecentChars: number;
    maxOlderDigestChars: number;
    maxRecentMessageChars: number;
    maxRecentAttachmentTextChars: number;
    maxLatestAttachmentTextChars: number;
  }
>;

type OutboundContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OutboundMessage = {
  role: "system" | "user" | "assistant";
  content: string | OutboundContentPart[];
};

interface SendChatOptions {
  messages: ChatMessage[];
  route: ChatRoute;
  authSession?: AuthSession | null;
  onChunk: (chunk: string) => void;
}

export async function streamAssistantReply({ messages, route, authSession, onChunk }: SendChatOptions) {
  const controller = new AbortController();
  const timeoutMs = requestTimeoutMsByMode[route.mode];
  let timedOut = false;
  let fullText = "";
  let watchdog: ReturnType<typeof window.setTimeout> | undefined;

  function resetWatchdog() {
    if (watchdog) window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    resetWatchdog();
    const response = await fetch(apiEndpoint("/api/chat"), {
      method: "POST",
      headers: requestHeaders(authSession),
      signal: controller.signal,
      body: JSON.stringify({
        mode: route.mode,
        model: route.model,
        thinkingEnabled: route.thinkingEnabled,
        reasoningEffort: route.reasoningEffort,
        messages: buildOutboundMessages(messages, route)
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
      if (response.status === 401) {
        throw new Error(`AUTH_REQUIRED:${errorText}`);
      }
      throw new Error(errorText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      resetWatchdog();
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(chunk);
    }

    return fullText.trim();
  } catch (error) {
    if (fullText.trim()) {
      const marker = timedOut
        ? "\n\n> 连接等待过久，回答已在这里暂停。可以点“继续回答”从这里接着写。"
        : "\n\n> 连接中断，回答已在这里暂停。可以点“继续回答”从这里接着写。";
      fullText += marker;
      onChunk(marker);
      return fullText.trim();
    }

    if (timedOut) {
      throw new Error("等待模型响应超时。建议点重新发送，或把问题拆成更短的分段。");
    }
    throw error;
  } finally {
    if (watchdog) window.clearTimeout(watchdog);
  }
}

export function fallbackReply(prompt: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "网络不可用或服务没有响应";
  return getOfflineFallback(prompt, reason);
}

function buildOutboundMessages(messages: ChatMessage[], route: ChatRoute): OutboundMessage[] {
  const policy = contextPolicies[route.mode];
  const meaningfulMessages = messages.filter((message) => !isLocalOnlyAssistantMessage(message));
  const latestUserId = [...meaningfulMessages].reverse().find((message) => message.role === "user")?.id;
  const recentMessages: ChatMessage[] = [];
  let recentChars = 0;

  for (let index = meaningfulMessages.length - 1; index >= 0; index -= 1) {
    const message = meaningfulMessages[index];
    const estimate = estimateMessageChars(message);
    const canFitByCount = recentMessages.length < policy.maxRecentMessages;
    const canFitByChars = recentChars + estimate <= policy.maxRecentChars;
    if (recentMessages.length >= 4 && (!canFitByCount || !canFitByChars)) break;

    recentMessages.unshift(message);
    recentChars += estimate;
  }

  const olderMessages = meaningfulMessages.slice(0, Math.max(0, meaningfulMessages.length - recentMessages.length));
  const outbound: OutboundMessage[] = [
    {
      role: "system",
      content: route.systemPrompt
    }
  ];

  if (olderMessages.length) {
    outbound.push({
      role: "system",
      content: olderConversationDigest(olderMessages, policy.maxOlderDigestChars)
    });
  }

  for (const message of recentMessages) {
    if (message.role === "system") continue;
    const isLatestUser = message.role === "user" && message.id === latestUserId;
    outbound.push({
      role: message.role,
      content:
        message.role === "user"
          ? outboundUserContent(message.content, message.attachments, {
              includeImages: isLatestUser,
              attachmentTextLimit: isLatestUser ? policy.maxLatestAttachmentTextChars : policy.maxRecentAttachmentTextChars,
              messageTextLimit: policy.maxRecentMessageChars
            })
          : truncateMiddle(message.content, policy.maxRecentMessageChars)
    });
  }

  return outbound;
}

function outboundUserContent(
  content: string,
  attachments: Attachment[] | undefined,
  options: { includeImages: boolean; attachmentTextLimit: number; messageTextLimit: number }
) {
  const text = contentWithAttachments(truncateMiddle(content, options.messageTextLimit), attachments, options.attachmentTextLimit);
  const imageParts = options.includeImages ? imageContentParts(attachments) : [];
  if (!imageParts.length) return text;

  return [{ type: "text" as const, text }, ...imageParts];
}

function contentWithAttachments(content: string, attachments: Attachment[] | undefined, attachmentTextLimit: number) {
  if (!attachments?.length) return content;
  return [content || "请参考我上传的补充材料。", attachmentDigest(attachments, attachmentTextLimit)].join("\n\n");
}

function imageContentParts(attachments?: Attachment[]): OutboundContentPart[] {
  if (!attachments?.length) return [];

  return attachments
    .filter((attachment) => attachment.kind === "image" && attachment.previewUrl && attachment.previewUrl.length <= maxImagePartChars)
    .slice(0, maxImageParts)
    .map((attachment) => ({
      type: "image_url",
      image_url: { url: attachment.previewUrl || "" }
    }));
}

function attachmentDigest(attachments: Attachment[], textLimit: number) {
  const sections = attachments.map((attachment, index) => {
    const header = `### 材料 ${index + 1}: ${attachment.name}`;
    const meta = `类型：${attachment.type || "未知"}；大小：${formatBytes(attachment.size)}`;

    if (attachment.textContent) {
      return `${header}\n${meta}\n\n\`\`\`text\n${truncateMiddle(attachment.textContent, textLimit)}\n\`\`\``;
    }

    if (attachment.kind === "image") {
      const imageNote =
        attachment.previewUrl && attachment.previewUrl.length <= maxImagePartChars
          ? "图片内容已随请求一并提交；请结合视觉内容和用户问题回答。"
          : "这是一张用户上传的图片，但图片过大，当前请求只包含文件信息；如需精确分析，请让用户补充关键视觉信息。";
      return `${header}\n${meta}\n\n${imageNote}`;
    }

    return `${header}\n${meta}\n\n这是一个二进制或暂不支持直接解析的文件。请基于文件名、类型和用户问题继续；如果需要文件内容，请明确要求用户粘贴关键片段。`;
  });

  return `<上传补充材料>\n\n${sections.join("\n\n")}\n\n</上传补充材料>`;
}

function olderConversationDigest(messages: ChatMessage[], maxChars: number) {
  const lines: string[] = [
    "<较早对话压缩摘要>",
    "以下是为了降低延迟而压缩的较早上下文。需要精确细节时，请提醒用户补充原文或关键片段。"
  ];

  for (const message of messages) {
    const role = message.role === "user" ? "用户" : message.role === "assistant" ? "助手" : "系统";
    const attachmentLine = message.attachments?.length
      ? `；附件：${message.attachments.map((attachment) => `${attachment.name}(${attachment.kind})`).join("，")}`
      : "";
    lines.push(`- ${role}：${compactText(message.content, 420)}${attachmentLine}`);
    const joined = lines.join("\n");
    if (joined.length >= maxChars) {
      return `${truncateMiddle(joined, maxChars)}\n</较早对话压缩摘要>`;
    }
  }

  return `${lines.join("\n")}\n</较早对话压缩摘要>`;
}

function isLocalOnlyAssistantMessage(message: ChatMessage) {
  return (
    message.role === "assistant" &&
    !message.model &&
    !message.fallbackReason &&
    (message.content.includes("这里是每日模式") ||
      message.content.includes("这里是数理模式") ||
      message.content.includes("这里是编程模式"))
  );
}

function estimateMessageChars(message: ChatMessage) {
  const attachmentChars =
    message.attachments?.reduce((total, attachment) => total + attachment.name.length + (attachment.textContent?.length || 0), 0) || 0;
  return message.content.length + attachmentChars;
}

function compactText(value: string, maxChars: number) {
  return truncateMiddle(value.replace(/\s+/g, " ").trim(), maxChars);
}

function truncateMiddle(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  const headLength = Math.max(1, Math.floor(maxChars * 0.62));
  const tailLength = Math.max(1, maxChars - headLength - 26);
  return `${value.slice(0, headLength)}\n...[中间内容已压缩]...\n${value.slice(-tailLength)}`;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function requestHeaders(authSession?: AuthSession | null) {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (authSession?.source === "server") {
    headers.authorization = `Bearer ${authSession.token}`;
  }

  return headers;
}
