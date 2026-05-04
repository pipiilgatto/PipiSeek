import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Composer } from "./components/Composer";
import { MenuIcon } from "./components/Icons";
import { MessageBubble } from "./components/MessageBubble";
import { ModeControls } from "./components/ModeControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sidebar } from "./components/Sidebar";
import { fallbackReply, streamAssistantReply } from "./lib/api";
import { appIcon192 } from "./lib/assets";
import { chooseRoute, improvementRoute } from "./lib/routing";
import { getSpeechSupport, speakAsMiaoyu, stopMiaoyuSpeech, type MiaoyuSpeechController } from "./lib/speech";
import { loadState, saveState } from "./lib/storage";
import type { AdvancedSettings, ChatMessage, ChatMode, ChatRoute, Conversation } from "./types";

const defaultAdvanced: AdvancedSettings = {
  reasoningEffort: "max"
};

const voiceDefaultsVersion = 2;

const welcomeMessageContent =
  "喵～你好呀！我是喵语助手。\n\n你可以直接打字；需要语音输入时，可在高级模式里开启持续语音后再点麦克风。每日模式默认使用 v4 flash 且不思考，只有很复杂的问题才会自动切到 v4 pro 且仍不思考；高级模式固定使用 v4 pro 并开启思考。";

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWelcomeConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId("conv"),
    title: "新的喵语对话",
    updatedAt: now,
    messages: [
      {
        id: createId("msg"),
        role: "assistant",
        content: welcomeMessageContent,
        createdAt: now,
        status: "idle"
      }
    ]
  };
}

export default function App() {
  const stored = useMemo(() => loadState(), []);
  const initialConversations = stored.conversations?.length
    ? normalizeStoredConversations(stored.conversations)
    : [createWelcomeConversation()];
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(
    stored.activeConversationId && initialConversations.some((item) => item.id === stored.activeConversationId)
      ? stored.activeConversationId
      : initialConversations[0].id
  );
  const [mode, setMode] = useState<ChatMode>(stored.mode || "daily");
  const [advanced, setAdvanced] = useState<AdvancedSettings>(() => normalizeAdvancedSettings(stored.advanced));
  const shouldApplyVoiceDefaults = stored.voiceDefaultsVersion !== voiceDefaultsVersion;
  const [continuousVoiceEnabled, setContinuousVoiceEnabled] = useState(
    shouldApplyVoiceDefaults ? true : (stored.continuousVoiceEnabled ?? true)
  );
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(
    shouldApplyVoiceDefaults ? false : (stored.voiceReplyEnabled ?? false)
  );
  const [offlineFallbackEnabled, setOfflineFallbackEnabled] = useState(stored.offlineFallbackEnabled ?? true);
  const [composerValue, setComposerValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const speechControllerRef = useRef<MiaoyuSpeechController | null>(null);
  const speechSupport = useMemo(() => getSpeechSupport(), []);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const latestMessage = activeConversation.messages[activeConversation.messages.length - 1];
  const latestMessageSignature = `${activeConversation.id}:${activeConversation.messages.length}:${latestMessage?.id || ""}:${
    latestMessage?.content.length || 0
  }:${latestMessage?.status || ""}`;

  useEffect(() => {
    saveState({
      conversations,
      activeConversationId,
      mode,
      advanced,
      continuousVoiceEnabled,
      voiceReplyEnabled,
      voiceDefaultsVersion,
      offlineFallbackEnabled
    });
  }, [advanced, activeConversationId, continuousVoiceEnabled, conversations, mode, offlineFallbackEnabled, voiceReplyEnabled]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const scrollBox = chatScrollRef.current;
      if (!scrollBox) return;
      scrollBox.scrollTo({ top: scrollBox.scrollHeight, behavior: "auto" });
      updateBackToTopVisibility(scrollBox);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [latestMessageSignature]);

  useEffect(() => {
    return () => {
      speechControllerRef.current?.stop();
      stopMiaoyuSpeech();
    };
  }, []);

  return (
    <div className={`app-shell ${mode === "advanced" ? "settings-expanded" : "settings-folded"}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeConversation.id}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelect={(id) => {
          setActiveConversationId(id);
          setIsSidebarOpen(false);
        }}
        onNew={handleNewConversation}
        onClear={handleClear}
      />

      <main className="chat-main">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" onClick={() => setIsSidebarOpen(true)} aria-label="打开侧栏">
            <MenuIcon />
          </button>
          <ModeControls mode={mode} onChange={setMode} />
          <div className="topbar-actions">
            <span className={`network-pill ${isOnline ? "online" : "offline"}`}>{isOnline ? "在线" : "离线"}</span>
          </div>
        </header>

        <section ref={chatScrollRef} className="chat-scroll" aria-label="聊天内容" onScroll={handleChatScroll}>
          <div className="conversation-meta">
            <img src={appIcon192} alt="" />
            <div>
              <h1>喵语助手</h1>
              <p>{mode === "daily" ? "每日模式：v4 flash 默认不思考，复杂问题自动升级" : "高级模式：v4 pro，始终启用思考"}</p>
            </div>
          </div>

          {activeConversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onImprove={handleImprove}
              onToggleSpeak={handleToggleSpeak}
              isSpeaking={speakingMessageId === message.id}
            />
          ))}
        </section>

        {showBackToTop ? (
          <button className="back-to-top-button" type="button" onClick={scrollConversationToTop}>
            回到顶部
          </button>
        ) : null}

        <div className="composer-wrap">
          <div className="route-preview">{routePreview()}</div>
          <Composer
            value={composerValue}
            isBusy={isBusy}
            speechSupport={speechSupport}
            continuousVoiceEnabled={continuousVoiceEnabled}
            onChange={setComposerValue}
            onSubmit={handleSubmit}
          />
        </div>
      </main>

      <SettingsPanel
        mode={mode}
        advanced={advanced}
        continuousVoiceEnabled={continuousVoiceEnabled}
        voiceReplyEnabled={voiceReplyEnabled}
        offlineFallbackEnabled={offlineFallbackEnabled}
        speechSupport={speechSupport}
        onAdvancedChange={setAdvanced}
        onContinuousVoiceChange={setContinuousVoiceEnabled}
        onVoiceReplyChange={setVoiceReplyEnabled}
        onOfflineFallbackChange={setOfflineFallbackEnabled}
        onReset={handleResetSettings}
      />

      {isSidebarOpen && (
        <button className="scrim" type="button" aria-label="关闭浮层" onClick={closeOverlays} />
      )}
    </div>
  );

  function routePreview() {
    const route = chooseRoute(composerValue || "日常聊天", mode, advanced);
    if (mode === "daily") return `自动选择 · ${route.model === "deepseek-v4-pro" ? "v4 pro" : "v4 flash"} · 不思考`;
    return `v4 pro · ${advanced.reasoningEffort === "max" ? "最大思考" : "深度思考"}`;
  }

  function closeOverlays() {
    setIsSidebarOpen(false);
  }

  function handleChatScroll(event: UIEvent<HTMLElement>) {
    updateBackToTopVisibility(event.currentTarget);
  }

  function updateBackToTopVisibility(scrollBox: HTMLElement) {
    const isLongConversation = scrollBox.scrollHeight - scrollBox.clientHeight > 160;
    setShowBackToTop(isLongConversation && scrollBox.scrollTop > 140);
  }

  function scrollConversationToTop() {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleToggleSpeak(messageId: string, text: string) {
    if (speakingMessageId === messageId) {
      speechControllerRef.current?.stop();
      speechControllerRef.current = null;
      setSpeakingMessageId(null);
      return;
    }

    speechControllerRef.current?.stop();
    setSpeakingMessageId(messageId);
    speechControllerRef.current = speakAsMiaoyu(text, {
      onStart: () => setSpeakingMessageId(messageId),
      onEnd: () => {
        speechControllerRef.current = null;
        setSpeakingMessageId((current) => (current === messageId ? null : current));
      }
    });

    if (!speechControllerRef.current) setSpeakingMessageId(null);
  }

  function handleNewConversation() {
    const conversation = createWelcomeConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setComposerValue("");
    setIsSidebarOpen(false);
  }

  function handleClear() {
    const confirmed = window.confirm("确定要清空本地对话记录吗？这个操作只会影响当前设备。");
    if (!confirmed) return;
    const conversation = createWelcomeConversation();
    setConversations([conversation]);
    setActiveConversationId(conversation.id);
  }

  function handleResetSettings() {
    setMode("daily");
    setAdvanced(defaultAdvanced);
    setContinuousVoiceEnabled(true);
    setVoiceReplyEnabled(false);
    setOfflineFallbackEnabled(true);
  }

  function updateActiveConversation(updater: (conversation: Conversation) => Conversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversationId ? updater(conversation) : conversation))
    );
  }

  async function handleSubmit(value: string) {
    const prompt = value.trim();
    if (!prompt || isBusy) return;
    setComposerValue("");
    await sendWithRoute(prompt, chooseRoute(prompt, mode, advanced));
  }

  async function sendWithRoute(prompt: string, route: ChatRoute, visibleUserText = prompt) {
    setIsBusy(true);
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: visibleUserText,
      createdAt: now
    };
    const assistantMessage: ChatMessage = {
      id: createId("msg"),
      role: "assistant",
      content: "",
      createdAt: now + 1,
      status: "streaming",
      model: route.model,
      thinkingEnabled: route.thinkingEnabled,
      reasoningEffort: route.reasoningEffort
    };

    const priorMessages = activeConversation.messages;
    const requestMessages = [...priorMessages, userMessage];

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: conversation.messages.some((message) => message.role === "user") ? conversation.title : makeTitle(prompt),
      updatedAt: Date.now(),
      messages: [...conversation.messages, userMessage, assistantMessage]
    }));

    try {
      let reply = "";
      await streamAssistantReply({
        messages: requestMessages,
        route,
        onChunk: (chunk) => {
          reply += chunk;
          patchMessage(assistantMessage.id, {
            content: reply,
            status: "streaming"
          });
        }
      });
      patchMessage(assistantMessage.id, {
        content: reply || "喵～这次没有收到有效内容。",
        status: "idle"
      });
      if (voiceReplyEnabled && reply) speakAsMiaoyu(reply);
    } catch (error) {
      const offlineText = offlineFallbackEnabled
        ? fallbackReply(prompt, error)
        : `喵～API 调用失败：${error instanceof Error ? error.message : "未知错误"}`;
      patchMessage(assistantMessage.id, {
        content: offlineText,
        status: offlineFallbackEnabled ? "offline" : "error",
        fallbackReason: error instanceof Error ? error.message : "未知错误"
      });
      if (voiceReplyEnabled) speakAsMiaoyu(offlineText);
    } finally {
      setIsBusy(false);
    }
  }

  function patchMessage(messageId: string, patch: Partial<ChatMessage>) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message))
    }));
  }

  async function handleImprove(messageId: string) {
    if (isBusy) return;
    const index = activeConversation.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;

    const assistantMessage = activeConversation.messages[index];
    const previousUser = [...activeConversation.messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!previousUser) return;

    const prompt = [
      "用户对上一版回答不满意。请用更严谨、更完整、更有条理的方式重新回答。",
      `原问题：${previousUser.content}`,
      `上一版回答：${assistantMessage.content}`,
      "请直接给出改进后的中文回答。"
    ].join("\n\n");

    await sendWithRoute(prompt, improvementRoute(), "不满意，请用 v4 pro 和最大思考重新回答。");
  }
}

function makeTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").slice(0, 18) || "新的喵语对话";
}

function normalizeStoredConversations(conversations: Conversation[]) {
  return conversations.map((conversation) => {
    const firstMessage = conversation.messages[0];
    if (
      firstMessage?.role !== "assistant" ||
      !firstMessage.content.includes("喵～你好呀！我是喵语助手。") ||
      !firstMessage.content.includes("每日模式会自动选择 v4 flash 或 v4 pro")
    ) {
      return conversation;
    }

    return {
      ...conversation,
      messages: [{ ...firstMessage, content: welcomeMessageContent }, ...conversation.messages.slice(1)]
    };
  });
}

function normalizeAdvancedSettings(settings?: Partial<AdvancedSettings>): AdvancedSettings {
  return {
    reasoningEffort: settings?.reasoningEffort === "high" ? "high" : "max"
  };
}
