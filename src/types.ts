export type Role = "system" | "user" | "assistant";

export type ChatMode = "daily" | "advanced";

export type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro";

export type ThinkingEffort = "high" | "max";

export type MessageStatus = "idle" | "streaming" | "offline" | "error";

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
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface AdvancedSettings {
  reasoningEffort: ThinkingEffort;
}

export interface ChatRoute {
  model: DeepSeekModel;
  thinkingEnabled: boolean;
  reasoningEffort?: ThinkingEffort;
  label: string;
}
