import { useEffect, useRef, useState, type FormEvent } from "react";
import { createContinuousRecognition, type SpeechSupport } from "../lib/speech";
import { MicIcon, SendIcon } from "./Icons";

interface ComposerProps {
  value: string;
  isBusy: boolean;
  speechSupport: SpeechSupport;
  continuousVoiceEnabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function Composer({ value, isBusy, speechSupport, continuousVoiceEnabled, onChange, onSubmit }: ComposerProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<ReturnType<typeof createContinuousRecognition>>(null);
  const latestValueRef = useRef(value);
  const canUseRecognition = speechSupport.recognition && continuousVoiceEnabled;

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    if (continuousVoiceEnabled) return;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, [continuousVoiceEnabled]);

  const canSend = value.trim().length > 0 && !isBusy;

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {interimText ? <div className="voice-interim">正在听：{interimText}</div> : null}
      <textarea
        value={value}
        rows={1}
        placeholder="和喵语助手聊点什么吧..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit(value);
          }
        }}
      />
      <div className="composer-actions">
        <button
          className={`round-button mic-button ${isListening ? "recording" : ""}`}
          type="button"
          disabled={!canUseRecognition}
          onClick={toggleListening}
          aria-label={isListening ? "停止持续语音" : "开始持续语音"}
          title={
            speechSupport.recognition
              ? continuousVoiceEnabled
                ? "开始持续语音"
                : "请先在高级模式打开持续语音"
              : "当前浏览器不支持语音识别"
          }
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
        const nextValue = latestValueRef.current ? `${latestValueRef.current}${text}` : text;
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
