import type { ChatMessage } from "../types";
import { appIcon192 } from "../lib/assets";
import { CopyIcon, PauseIcon, SpeakerIcon, ThumbsDownIcon, ThumbsUpIcon } from "./Icons";

interface MessageBubbleProps {
  message: ChatMessage;
  onImprove: (messageId: string) => void;
  onToggleSpeak: (messageId: string, text: string) => void;
  isSpeaking: boolean;
}

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
          {message.content ? <FormattedText text={message.content} /> : <span className="typing-dots">正在回复</span>}
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
            <button type="button" title="不满意，认真想" onClick={() => onImprove(message.id)}>
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

function FormattedText({ text }: { text: string }) {
  return (
    <div className="formatted-text">
      {text.split("\n").map((line, index) => (
        <p key={`${line}-${index}`}>{line || "\u00a0"}</p>
      ))}
    </div>
  );
}
