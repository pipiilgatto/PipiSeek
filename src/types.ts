export type Role = "system" | "user" | "assistant";

export type ChatMode = "daily" | "math" | "coding";

export type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro";

export type ThinkingEffort = "high" | "max";

export type MessageStatus = "idle" | "streaming" | "offline" | "error";

export type AttachmentKind = "image" | "text" | "file";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: AttachmentKind;
  previewUrl?: string;
  textContent?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  model?: DeepSeekModel;
  thinkingEnabled?: boolean;
  reasoningEffort?: ThinkingEffort;
  fallbackReason?: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ModeWorkspace {
  conversations: Conversation[];
  activeConversationId: string;
}

export interface ModeConfig {
  mode: ChatMode;
  label: string;
  shortLabel: string;
  folderLabel: string;
  headline: string;
  description: string;
  welcome: string;
  systemPrompt: string;
}

export interface ChatRoute {
  mode: ChatMode;
  model: DeepSeekModel;
  thinkingEnabled: boolean;
  reasoningEffort?: ThinkingEffort;
  label: string;
  systemPrompt: string;
}
