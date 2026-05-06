import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Composer } from "./components/Composer";
import { LoginScreen } from "./components/LoginScreen";
import { MenuIcon } from "./components/Icons";
import { MessageBubble } from "./components/MessageBubble";
import { ModeControls } from "./components/ModeControls";
import { Sidebar } from "./components/Sidebar";
import { fallbackReply, streamAssistantReply } from "./lib/api";
import { appIcon192 } from "./lib/assets";
import { clearAuthSession, loadAuthSession, type AuthSession } from "./lib/auth";
import { MODE_CONFIGS, MODE_ORDER, chooseRoute, improvementRoute } from "./lib/routing";
import { getSpeechSupport, speakAsMiaoyu, stopMiaoyuSpeech, type MiaoyuSpeechController } from "./lib/speech";
import { isConversationArray, loadState, saveState } from "./lib/storage";
import type { Attachment, ChatMessage, ChatMode, ChatRoute, Conversation, ModeWorkspace } from "./types";

const maxAttachmentCount = 8;
const maxPreviewBytes = 520_000;
const maxImagePreviewEdge = 1280;
const compressedImageQuality = 0.78;
const maxReadableTextBytes = 250_000;
const maxStoredTextChars = 12_000;
const textExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "yaml",
  "yml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "rs",
  "go",
  "sh",
  "sql",
  "log"
]);

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWelcomeConversation(mode: ChatMode): Conversation {
  const now = Date.now();
  return {
    id: createId(`conv-${mode}`),
    title: MODE_CONFIGS[mode].label,
    updatedAt: now,
    messages: [
      {
        id: createId("msg"),
        role: "assistant",
        content: MODE_CONFIGS[mode].welcome,
        createdAt: now,
        status: "idle"
      }
    ]
  };
}

function createWorkspace(mode: ChatMode, conversations = [createWelcomeConversation(mode)]): ModeWorkspace {
  const normalized = conversations.length ? normalizeStoredConversations(conversations, mode) : [createWelcomeConversation(mode)];
  return {
    conversations: normalized,
    activeConversationId: normalized[0].id
  };
}

export default function App() {
  const stored = useMemo(() => loadState(), []);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession());
  const [mode, setMode] = useState<ChatMode>(() => normalizeMode(stored.activeMode || stored.mode));
  const [workspaces, setWorkspaces] = useState<Record<ChatMode, ModeWorkspace>>(() => normalizeWorkspaces(stored));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => Boolean(stored.sidebarCollapsed));
  const [offlineFallbackEnabled] = useState(stored.offlineFallbackEnabled !== false);
  const [composerValue, setComposerValue] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<Attachment[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const speechControllerRef = useRef<MiaoyuSpeechController | null>(null);
  const speechSupport = useMemo(() => getSpeechSupport(), []);

  const workspace = workspaces[mode];
  const activeConversation =
    workspace.conversations.find((conversation) => conversation.id === workspace.activeConversationId) || workspace.conversations[0];
  const latestMessage = activeConversation.messages[activeConversation.messages.length - 1];
  const latestMessageSignature = `${mode}:${activeConversation.id}:${activeConversation.messages.length}:${latestMessage?.id || ""}:${
    latestMessage?.content.length || 0
  }:${latestMessage?.status || ""}`;

  useEffect(() => {
    saveState({
      version: 2,
      activeMode: mode,
      workspaces,
      sidebarCollapsed,
      offlineFallbackEnabled
    });
  }, [mode, workspaces, sidebarCollapsed, offlineFallbackEnabled]);

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

  if (!authSession) {
    return <LoginScreen onLogin={setAuthSession} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      <Sidebar
        folders={MODE_ORDER.map((item) => ({
          mode: item,
          conversations: workspaces[item].conversations,
          activeConversationId: workspaces[item].activeConversationId
        }))}
        activeMode={mode}
        collapsed={sidebarCollapsed && !isSidebarOpen}
        isOpen={isSidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onClose={() => setIsSidebarOpen(false)}
        onModeSelect={handleModeChange}
        onConversationSelect={handleConversationSelect}
        onNew={handleNewConversation}
        onClearMode={handleClearMode}
        onLogout={handleLogout}
      />

      <main className="chat-main">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" onClick={() => setIsSidebarOpen(true)} aria-label="打开侧栏">
            <MenuIcon />
          </button>
          <ModeControls mode={mode} onChange={handleModeChange} />
          <div className="topbar-actions">
            <span className={`network-pill ${isOnline ? "online" : "offline"}`}>{isOnline ? "在线" : "离线"}</span>
          </div>
        </header>

        <section ref={chatScrollRef} className="chat-scroll" aria-label="聊天内容" onScroll={handleChatScroll}>
          <div className="conversation-meta">
            <img src={appIcon192} alt="" />
            <div>
              <h1>{MODE_CONFIGS[mode].headline}</h1>
              <p>{MODE_CONFIGS[mode].description}</p>
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
            attachments={composerAttachments}
            isBusy={isBusy}
            speechSupport={speechSupport}
            onChange={setComposerValue}
            onAddFiles={handleFilesAdded}
            onRemoveAttachment={handleRemoveAttachment}
            onSubmit={handleSubmit}
          />
        </div>
      </main>

      {isSidebarOpen && <button className="scrim" type="button" aria-label="关闭浮层" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );

  function routePreview() {
    return chooseRoute(composerValue || attachmentPreviewText(composerAttachments) || "日常聊天", mode).label;
  }

  function handleModeChange(nextMode: ChatMode) {
    setMode(nextMode);
    setComposerValue("");
    setComposerAttachments([]);
    setIsSidebarOpen(false);
  }

  function handleConversationSelect(nextMode: ChatMode, conversationId: string) {
    setMode(nextMode);
    setWorkspaces((current) => ({
      ...current,
      [nextMode]: {
        ...current[nextMode],
        activeConversationId: conversationId
      }
    }));
    setComposerValue("");
    setComposerAttachments([]);
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
    const conversation = createWelcomeConversation(mode);
    setWorkspaces((current) => ({
      ...current,
      [mode]: {
        conversations: [conversation, ...current[mode].conversations],
        activeConversationId: conversation.id
      }
    }));
    setComposerValue("");
    setComposerAttachments([]);
    setIsSidebarOpen(false);
  }

  function handleClearMode() {
    const confirmed = window.confirm(`确定要清空${MODE_CONFIGS[mode].label}的本地对话记录吗？这个操作不会影响其他模式。`);
    if (!confirmed) return;
    const workspace = createWorkspace(mode);
    setWorkspaces((current) => ({
      ...current,
      [mode]: workspace
    }));
  }

  async function handleFilesAdded(files: FileList) {
    const availableSlots = Math.max(0, maxAttachmentCount - composerAttachments.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (!selectedFiles.length) return;

    const attachments = await Promise.all(selectedFiles.map(readAttachment));
    setComposerAttachments((current) => [...current, ...attachments]);
  }

  function handleRemoveAttachment(id: string) {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function updateActiveConversation(updater: (conversation: Conversation) => Conversation) {
    setWorkspaces((current) => {
      const currentWorkspace = current[mode];
      return {
        ...current,
        [mode]: {
          ...currentWorkspace,
          conversations: currentWorkspace.conversations.map((conversation) =>
            conversation.id === currentWorkspace.activeConversationId ? updater(conversation) : conversation
          )
        }
      };
    });
  }

  async function handleSubmit(value: string) {
    const prompt = value.trim();
    if ((!prompt && !composerAttachments.length) || isBusy) return;

    const attachments = composerAttachments;
    const effectivePrompt = prompt || "请参考我上传的补充材料。";
    setComposerValue("");
    setComposerAttachments([]);
    await sendWithRoute(effectivePrompt, chooseRoute(`${effectivePrompt}\n${attachmentPreviewText(attachments)}`, mode), effectivePrompt, attachments);
  }

  async function sendWithRoute(prompt: string, route: ChatRoute, visibleUserText = prompt, attachments: Attachment[] = []) {
    setIsBusy(true);
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: visibleUserText,
      attachments,
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
      title: conversation.messages.some((message) => message.role === "user") ? conversation.title : makeTitle(prompt, attachments),
      updatedAt: Date.now(),
      messages: [...conversation.messages, userMessage, assistantMessage]
    }));

    try {
      let reply = "";
      await streamAssistantReply({
        messages: requestMessages,
        route,
        authSession,
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
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
        clearAuthSession();
        setAuthSession(null);
      }
      const offlineText = offlineFallbackEnabled
        ? fallbackReply(prompt, error)
        : `喵～API 调用失败：${error instanceof Error ? error.message : "未知错误"}`;
      patchMessage(assistantMessage.id, {
        content: offlineText,
        status: offlineFallbackEnabled ? "offline" : "error",
        fallbackReason: error instanceof Error ? error.message : "未知错误"
      });
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
      previousUser.attachments?.length ? attachmentPreviewText(previousUser.attachments) : "",
      `上一版回答：${assistantMessage.content}`,
      "请直接给出改进后的中文回答。"
    ]
      .filter(Boolean)
      .join("\n\n");

    await sendWithRoute(prompt, improvementRoute(mode), "不满意，请重新回答。", previousUser.attachments || []);
  }

  function handleLogout() {
    clearAuthSession();
    speechControllerRef.current?.stop();
    stopMiaoyuSpeech();
    setAuthSession(null);
  }
}

function normalizeMode(value: unknown): ChatMode {
  return value === "math" || value === "coding" ? value : "daily";
}

function normalizeWorkspaces(stored: Record<string, unknown>): Record<ChatMode, ModeWorkspace> {
  const rawWorkspaces = stored.workspaces as Partial<Record<ChatMode, Partial<ModeWorkspace>>> | undefined;
  const workspaces = Object.fromEntries(MODE_ORDER.map((mode) => [mode, createWorkspace(mode)])) as Record<ChatMode, ModeWorkspace>;

  for (const mode of MODE_ORDER) {
    const rawWorkspace = rawWorkspaces?.[mode];
    if (isConversationArray(rawWorkspace?.conversations)) {
      const conversations = normalizeStoredConversations(rawWorkspace.conversations, mode);
      workspaces[mode] = {
        conversations,
        activeConversationId:
          typeof rawWorkspace.activeConversationId === "string" &&
          conversations.some((conversation) => conversation.id === rawWorkspace.activeConversationId)
            ? rawWorkspace.activeConversationId
            : conversations[0].id
      };
    }
  }

  if (!rawWorkspaces && isConversationArray(stored.conversations)) {
    const conversations = normalizeStoredConversations(stored.conversations, "daily");
    workspaces.daily = {
      conversations,
      activeConversationId:
        typeof stored.activeConversationId === "string" &&
        conversations.some((conversation) => conversation.id === stored.activeConversationId)
          ? stored.activeConversationId
          : conversations[0].id
    };
  }

  return workspaces;
}

function normalizeStoredConversations(conversations: Conversation[], mode: ChatMode) {
  const normalized = conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments || []
    }))
  }));

  const firstMessage = normalized[0]?.messages[0];
  const shouldRefreshWelcome =
    firstMessage?.role === "assistant" &&
    (firstMessage.content.includes("喵～你好呀！我是喵语助手。") || firstMessage.content.includes("喵～这里是"));

  if (!shouldRefreshWelcome) {
    return normalized;
  }

  return [
    {
      ...normalized[0],
      messages: [{ ...firstMessage, content: MODE_CONFIGS[mode].welcome }, ...normalized[0].messages.slice(1)]
    },
    ...normalized.slice(1)
  ];
}

function makeTitle(prompt: string, attachments: Attachment[]) {
  const textTitle = prompt.replace(/\s+/g, " ").slice(0, 18);
  if (textTitle) return textTitle;
  return attachments[0]?.name.slice(0, 18) || "新的喵语对话";
}

function attachmentPreviewText(attachments: Attachment[]) {
  if (!attachments.length) return "";
  return attachments.map((attachment) => `${attachment.name} (${attachment.type || "文件"}, ${formatBytes(attachment.size)})`).join("\n");
}

async function readAttachment(file: File): Promise<Attachment> {
  const id = createId("att");
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const kind = file.type.startsWith("image/") ? "image" : isReadableTextFile(file, extension) ? "text" : "file";

  if (kind === "image") {
    const previewUrl = await readImagePreview(file);
    return {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      kind,
      previewUrl
    };
  }

  if (kind === "text") {
    const text = await readFileAsText(file);
    return {
      id,
      name: file.name,
      type: file.type || `text/${extension}`,
      size: file.size,
      kind,
      textContent: text.slice(0, maxStoredTextChars)
    };
  }

  return {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    kind
  };
}

function isReadableTextFile(file: File, extension: string) {
  return file.size <= maxReadableTextBytes && (file.type.startsWith("text/") || textExtensions.has(extension));
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readImagePreview(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length <= maxPreviewBytes) return dataUrl;
  return compressImageDataUrl(dataUrl).catch(() => undefined);
}

function compressImageDataUrl(dataUrl: string) {
  return new Promise<string | undefined>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxImagePreviewEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(undefined);
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", compressedImageQuality);
      resolve(compressed.length <= maxPreviewBytes ? compressed : undefined);
    };
    image.onerror = () => reject(new Error("图片预览生成失败"));
    image.src = dataUrl;
  });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
