import { getOfflineFallback } from "../data/fallbacks";
import type { Attachment, ChatMessage, ChatRoute } from "../types";

const API_BASE_URL = "https://pipicat.xin";
const maxImageParts = 2;
const maxImagePartChars = 760_000;

type OutboundContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface SendChatOptions {
  messages: ChatMessage[];
  route: ChatRoute;
  onChunk: (chunk: string) => void;
}

export async function streamAssistantReply({ messages, route, onChunk }: SendChatOptions) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mode: route.mode,
      model: route.model,
      thinkingEnabled: route.thinkingEnabled,
      reasoningEffort: route.reasoningEffort,
      messages: [
        {
          role: "system",
          content: route.systemPrompt
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.role === "user" ? outboundUserContent(message.content, message.attachments) : message.content
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

function outboundUserContent(content: string, attachments?: Attachment[]) {
  const text = contentWithAttachments(content, attachments);
  const imageParts = imageContentParts(attachments);
  if (!imageParts.length) return text;

  return [{ type: "text", text }, ...imageParts];
}

function contentWithAttachments(content: string, attachments?: Attachment[]) {
  if (!attachments?.length) return content;
  return [content || "请参考我上传的补充材料。", attachmentDigest(attachments)].join("\n\n");
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

function attachmentDigest(attachments: Attachment[]) {
  const sections = attachments.map((attachment, index) => {
    const header = `### 材料 ${index + 1}: ${attachment.name}`;
    const meta = `类型：${attachment.type || "未知"}；大小：${formatBytes(attachment.size)}`;

    if (attachment.textContent) {
      return `${header}\n${meta}\n\n\`\`\`text\n${attachment.textContent}\n\`\`\``;
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

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
