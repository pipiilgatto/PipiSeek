import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Attachment } from "../types";
import { createContinuousRecognition, type SpeechSupport } from "../lib/speech";
import { FileIcon, MicIcon, SendIcon, UploadIcon } from "./Icons";

interface ComposerProps {
  value: string;
  attachments: Attachment[];
  isBusy: boolean;
  speechSupport: SpeechSupport;
  onChange: (value: string) => void;
  onAddFiles: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: (value: string) => void;
}

export function Composer({
  value,
  attachments,
  isBusy,
  speechSupport,
  onChange,
  onAddFiles,
  onRemoveAttachment,
  onSubmit
}: ComposerProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createContinuousRecognition>>(null);
  const latestValueRef = useRef(value);
  const canUseRecognition = speechSupport.recognition;

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isBusy;

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {interimText ? <div className="voice-interim">正在听：{interimText}</div> : null}

      {attachments.length ? (
        <div className="attachment-strip" aria-label="已上传材料">
          {attachments.map((attachment) => (
            <div className="attachment-chip" key={attachment.id}>
              {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : <FileIcon />}
              <span>{attachment.name}</span>
              <button type="button" onClick={() => onRemoveAttachment(attachment.id)} aria-label={`移除 ${attachment.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <textarea
        value={value}
        rows={1}
        placeholder="输入问题，或上传图片/文件作为补充材料..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit(value);
          }
        }}
      />

      <div className="composer-actions">
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          multiple
          accept="image/*,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.rs,.go,.sh,.sql,.log,.pdf,.doc,.docx"
          onChange={handleFileChange}
        />
        <button className="round-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="上传图片或文件">
          <UploadIcon />
        </button>
        <button
          className={`round-button mic-button ${isListening ? "recording" : ""}`}
          type="button"
          disabled={!canUseRecognition}
          onClick={toggleListening}
          aria-label={isListening ? "停止持续语音" : "开始持续语音"}
          title={speechSupport.recognition ? "持续语音" : "当前浏览器不支持语音识别"}
        >
          <MicIcon />
        </button>
        <button className="send-button" type="submit" disabled={!canSend}>
          <SendIcon />
          发送
        </button>
      </div>
    </form>
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSubmit(value);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) onAddFiles(event.target.files);
    event.target.value = "";
  }

  function toggleListening() {
    if (!canUseRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText("");
      return;
    }

    const recognition = createContinuousRecognition({
      onFinalText: (text) => {
        const separator = latestValueRef.current && !latestValueRef.current.endsWith(" ") ? " " : "";
        const nextValue = latestValueRef.current ? `${latestValueRef.current}${separator}${text}` : text;
        latestValueRef.current = nextValue;
        onChange(nextValue);
      },
      onInterimText: setInterimText,
      onStop: () => {
        setIsListening(false);
        setInterimText("");
      }
    });

    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }
}
