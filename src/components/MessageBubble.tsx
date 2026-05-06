import type { Attachment, ChatMessage } from "../types";
import { appIcon192 } from "../lib/assets";
import { CopyIcon, FileIcon, PauseIcon, SpeakerIcon, ThumbsDownIcon, ThumbsUpIcon } from "./Icons";

interface MessageBubbleProps {
  message: ChatMessage;
  onImprove: (messageId: string) => void;
  onToggleSpeak: (messageId: string, text: string) => void;
  isSpeaking: boolean;
}

type MarkdownBlock =
  | { type: "code"; language: string; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "hr" }
  | { type: "quote"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; content: string };

export function MessageBubble({ message, onImprove, onToggleSpeak, isSpeaking }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`message ${message.role}`}>
      {isAssistant ? (
        <div className="avatar assistant-avatar">
          <img src={appIcon192} alt="" />
        </div>
      ) : null}

      <div className="message-stack">
        <div className="message-bubble">
          {message.content ? <MarkdownContent text={message.content} /> : <span className="typing-dots">正在回复</span>}
          {message.attachments?.length ? <AttachmentGallery attachments={message.attachments} /> : null}
          {message.status === "offline" ? <p className="fallback-note">已使用离线回复</p> : null}
        </div>

        {isAssistant ? (
          <div className="message-actions">
            <span>{modelLabel(message)}</span>
            <button type="button" title="复制" onClick={() => navigator.clipboard?.writeText(message.content)}>
              <CopyIcon />
            </button>
            <button type="button" title="满意">
              <ThumbsUpIcon />
            </button>
            <button type="button" title="不满意，重新回答" onClick={() => onImprove(message.id)}>
              <ThumbsDownIcon />
            </button>
            <button
              type="button"
              title={isSpeaking ? "停止朗读" : "朗读"}
              aria-label={isSpeaking ? "停止朗读" : "朗读"}
              onClick={() => onToggleSpeak(message.id, message.content)}
            >
              {isSpeaking ? <PauseIcon /> : <SpeakerIcon />}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function modelLabel(message: ChatMessage) {
  if (message.status === "offline") return "离线回复";
  if (!message.model) return "本地";
  const model = message.model === "deepseek-v4-pro" ? "v4 pro" : "v4 flash";
  const thinking = message.thinkingEnabled ? ` · ${message.reasoningEffort === "max" ? "最大思考" : "深度思考"}` : " · 不思考";
  return `${model}${thinking}`;
}

function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="message-attachments">
      {attachments.map((attachment) => (
        <div className="message-attachment" key={attachment.id}>
          {attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.name} /> : <FileIcon />}
          <div>
            <strong>{attachment.name}</strong>
            <span>{attachment.type || "文件"} · {formatBytes(attachment.size)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="formatted-text markdown-body">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <div className="code-card" key={index}>
              {block.language ? <div className="code-header">{block.language}</div> : null}
              <pre>
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "heading") {
          const Tag = `h${Math.min(block.level, 3)}` as "h1" | "h2" | "h3";
          return <Tag key={index}>{renderInline(block.content)}</Tag>;
        }

        if (block.type === "quote") {
          return <blockquote key={index}>{renderInline(block.content)}</blockquote>;
        }

        if (block.type === "hr") {
          return <hr key={index} />;
        }

        if (block.type === "table") {
          return (
            <div className="table-scroll" key={index}>
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`}>{renderInline(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {block.headers.map((_, cellIndex) => (
                        <td key={cellIndex}>{renderInline(row[cellIndex] || "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </Tag>
          );
        }

        return <p key={index}>{renderInline(block.content)}</p>;
      })}
    </div>
  );
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        content.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language, content: content.join("\n") });
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, content: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index]);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", content: quoteLines.join(" ") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[index]) : /^\s*[-*]\s+/.test(lines[index]))) {
        items.push(lines[index].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^\s*---+\s*$/.test(lines[index]) &&
      !isTableStart(lines, index) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraph.join("\n") });
  }

  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = sanitizeHref(link[2]);
      if (href) {
        return (
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      }
    }
    return <span key={index}>{part}</span>;
  });
}

function isTableStart(lines: string[], index: number) {
  return (
    /^\s*\|.*\|\s*$/.test(lines[index] || "") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || "")
  );
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function sanitizeHref(rawHref: string) {
  const href = rawHref.trim();
  if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith("#")) return href;
  return "";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
