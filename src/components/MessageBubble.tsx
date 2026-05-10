import { useState, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { Attachment, ChatMessage } from "../types";
import { appIcon192 } from "../lib/assets";
import { ContinueIcon, CopyIcon, DownloadIcon, FileIcon, PauseIcon, SpeakerIcon, ThumbsDownIcon, ThumbsUpIcon } from "./Icons";

interface MessageBubbleProps {
  message: ChatMessage;
  onImprove: (messageId: string) => void;
  onContinue: (messageId: string) => void;
  onToggleSpeak: (messageId: string, text: string) => void;
  isSpeaking: boolean;
}

type MarkdownBlock =
  | { type: "code"; language: string; content: string }
  | { type: "math"; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "hr" }
  | { type: "quote"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; content: string };

export function MessageBubble({ message, onImprove, onContinue, onToggleSpeak, isSpeaking }: MessageBubbleProps) {
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
            <button type="button" title="复制" onClick={() => writeClipboard(message.content)}>
              <CopyIcon />
            </button>
            <button type="button" title="满意">
              <ThumbsUpIcon />
            </button>
            <button type="button" title="不满意，重新回答" onClick={() => onImprove(message.id)}>
              <ThumbsDownIcon />
            </button>
            <button type="button" title="继续回答" aria-label="继续回答" onClick={() => onContinue(message.id)}>
              <ContinueIcon />
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
          return <CodeBlock key={index} language={block.language} content={block.content} index={index} />;
        }

        if (block.type === "math") {
          return <MathBlock key={index} formula={block.content} />;
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

function CodeBlock({ language, content, index }: { language: string; content: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const label = language || "code";

  async function copyCode() {
    await writeClipboard(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadCode() {
    const blob = new Blob([codeBlockHtml(content, label)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `miaoyu-code-${sanitizeFilename(label)}-${index + 1}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="code-card">
      <div className="code-header">
        <span>{label}</span>
        <div className="code-actions">
          <button type="button" title={copied ? "已复制" : "复制代码"} aria-label={copied ? "已复制" : "复制代码"} onClick={copyCode}>
            <CopyIcon />
          </button>
          <button type="button" title="下载 HTML" aria-label="下载 HTML" onClick={downloadCode}>
            <DownloadIcon />
          </button>
        </div>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MathBlock({ formula }: { formula: string }) {
  return <div className="math-display" dangerouslySetInnerHTML={{ __html: renderMath(formula, true) }} />;
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

    if (line.trim().startsWith("$$")) {
      const math = collectMathBlock(lines, index, "$$", "$$");
      blocks.push({ type: "math", content: math.content });
      index = math.nextIndex;
      continue;
    }

    if (line.trim().startsWith("\\[")) {
      const math = collectMathBlock(lines, index, "\\[", "\\]");
      blocks.push({ type: "math", content: math.content });
      index = math.nextIndex;
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
      !lines[index].trim().startsWith("$$") &&
      !lines[index].trim().startsWith("\\[") &&
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

function collectMathBlock(lines: string[], startIndex: number, startDelimiter: string, endDelimiter: string) {
  const content: string[] = [];
  const firstLine = lines[startIndex].trim();
  let remainder = firstLine.slice(startDelimiter.length);
  let closeIndex = findUnescaped(remainder, endDelimiter);

  if (closeIndex >= 0) {
    return {
      content: remainder.slice(0, closeIndex).trim(),
      nextIndex: startIndex + 1
    };
  }

  if (remainder.trim()) content.push(remainder);

  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    closeIndex = findUnescaped(line, endDelimiter);
    if (closeIndex >= 0) {
      content.push(line.slice(0, closeIndex));
      return {
        content: content.join("\n").trim(),
        nextIndex: index + 1
      };
    }
    content.push(line);
    index += 1;
  }

  return {
    content: content.join("\n").trim(),
    nextIndex: index
  };
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < text.length) {
    const nextToken = nextInlineToken(text, index);
    if (!nextToken) {
      nodes.push(<span key={nodes.length}>{text.slice(index)}</span>);
      break;
    }

    if (nextToken.start > index) {
      nodes.push(<span key={nodes.length}>{text.slice(index, nextToken.start)}</span>);
    }

    if (nextToken.type === "code") {
      nodes.push(<code key={nodes.length}>{nextToken.content}</code>);
    } else if (nextToken.type === "bold") {
      nodes.push(<strong key={nodes.length}>{renderInline(nextToken.content)}</strong>);
    } else if (nextToken.type === "link") {
      const href = sanitizeHref(nextToken.href);
      nodes.push(
        href ? (
          <a key={nodes.length} href={href} target="_blank" rel="noreferrer">
            {nextToken.label}
          </a>
        ) : (
          <span key={nodes.length}>{nextToken.raw}</span>
        )
      );
    } else if (nextToken.type === "math") {
      nodes.push(
        <span
          key={nodes.length}
          className="math-inline"
          dangerouslySetInnerHTML={{ __html: renderMath(nextToken.content, false) }}
        />
      );
    }

    index = nextToken.end;
  }

  return nodes;
}

type InlineToken =
  | { type: "code"; start: number; end: number; content: string }
  | { type: "bold"; start: number; end: number; content: string }
  | { type: "link"; start: number; end: number; label: string; href: string; raw: string }
  | { type: "math"; start: number; end: number; content: string };

function nextInlineToken(text: string, fromIndex: number): InlineToken | null {
  const candidates = [
    inlineCodeToken(text, fromIndex),
    inlineBoldToken(text, fromIndex),
    inlineLinkToken(text, fromIndex),
    inlineMathToken(text, fromIndex)
  ].filter(Boolean) as InlineToken[];

  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.start - b.start || a.end - b.end)[0];
}

function inlineCodeToken(text: string, fromIndex: number): InlineToken | null {
  const start = text.indexOf("`", fromIndex);
  if (start < 0) return null;
  const end = text.indexOf("`", start + 1);
  if (end < 0) return null;
  return { type: "code", start, end: end + 1, content: text.slice(start + 1, end) };
}

function inlineBoldToken(text: string, fromIndex: number): InlineToken | null {
  const start = text.indexOf("**", fromIndex);
  if (start < 0) return null;
  const end = text.indexOf("**", start + 2);
  if (end < 0) return null;
  return { type: "bold", start, end: end + 2, content: text.slice(start + 2, end) };
}

function inlineLinkToken(text: string, fromIndex: number): InlineToken | null {
  const start = text.indexOf("[", fromIndex);
  if (start < 0) return null;
  const labelEnd = text.indexOf("](", start + 1);
  if (labelEnd < 0) return null;
  const hrefEnd = text.indexOf(")", labelEnd + 2);
  if (hrefEnd < 0) return null;
  return {
    type: "link",
    start,
    end: hrefEnd + 1,
    label: text.slice(start + 1, labelEnd),
    href: text.slice(labelEnd + 2, hrefEnd),
    raw: text.slice(start, hrefEnd + 1)
  };
}

function inlineMathToken(text: string, fromIndex: number): InlineToken | null {
  const parenStart = text.indexOf("\\(", fromIndex);
  const bracketStart = text.indexOf("\\[", fromIndex);
  const dollarStart = findInlineDollar(text, fromIndex);

  if (
    bracketStart >= 0 &&
    (parenStart < 0 || bracketStart < parenStart) &&
    (dollarStart < 0 || bracketStart < dollarStart)
  ) {
    const end = findUnescaped(text, "\\]", bracketStart + 2);
    if (end >= 0) return { type: "math", start: bracketStart, end: end + 2, content: text.slice(bracketStart + 2, end) };
  }

  if (parenStart >= 0 && (dollarStart < 0 || parenStart < dollarStart)) {
    const end = findUnescaped(text, "\\)", parenStart + 2);
    if (end >= 0) return { type: "math", start: parenStart, end: end + 2, content: text.slice(parenStart + 2, end) };
  }

  if (dollarStart >= 0) {
    const end = findUnescaped(text, "$", dollarStart + 1);
    if (end >= 0) return { type: "math", start: dollarStart, end: end + 1, content: text.slice(dollarStart + 1, end) };
  }

  return null;
}

function renderMath(formula: string, displayMode: boolean) {
  return katex.renderToString(formula, {
    displayMode,
    throwOnError: false,
    strict: "ignore",
    trust: false
  });
}

function findInlineDollar(text: string, fromIndex: number) {
  let index = findUnescaped(text, "$", fromIndex);
  while (index >= 0) {
    const previous = text[index - 1];
    const next = text[index + 1];
    if (text[index + 1] !== "$" && previous !== "$" && next && !/\s/.test(next)) return index;
    index = findUnescaped(text, "$", index + 1);
  }
  return -1;
}

function findUnescaped(text: string, needle: string, fromIndex = 0) {
  let index = text.indexOf(needle, fromIndex);
  while (index >= 0) {
    if (!isEscaped(text, index)) return index;
    index = text.indexOf(needle, index + needle.length);
  }
  return -1;
}

function isEscaped(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "code";
}

function codeBlockHtml(content: string, language: string) {
  const title = `Miaoyu code block - ${language}`;
  return `<!doctype html>
<html lang="zh-Hans">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        padding: 24px;
        background: #f8faf9;
        color: #14201e;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 980px;
        margin: 0 auto;
      }
      h1 {
        margin: 0 0 14px;
        font-size: 18px;
      }
      pre {
        margin: 0;
        padding: 18px;
        overflow: auto;
        background: #14201e;
        color: #e8f8f6;
        border-radius: 10px;
        line-height: 1.6;
      }
      code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 14px;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(language)}</h1>
      <pre><code>${escapeHtml(content)}</code></pre>
    </main>
  </body>
</html>
`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
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
