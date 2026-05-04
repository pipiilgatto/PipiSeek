import type { AdvancedSettings, ChatMode, Conversation } from "../types";

const STORAGE_KEY = "miaoyu-assistant-state-v1";

export interface StoredState {
  conversations: Conversation[];
  activeConversationId: string;
  mode: ChatMode;
  advanced: AdvancedSettings;
  continuousVoiceEnabled: boolean;
  voiceReplyEnabled: boolean;
  voiceDefaultsVersion: number;
  offlineFallbackEnabled: boolean;
}

export function loadState(): Partial<StoredState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}
