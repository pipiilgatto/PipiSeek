import type { ChatMode, Conversation, ModeWorkspace } from "../types";

const STORAGE_KEY = "miaoyu-assistant-state-v2";

export interface StoredState {
  version: 2;
  activeMode: ChatMode;
  workspaces: Record<ChatMode, ModeWorkspace>;
  sidebarCollapsed: boolean;
  offlineFallbackEnabled: boolean;
}

export function loadState(): Partial<StoredState> & Record<string, unknown> {
  try {
    const nextRaw = localStorage.getItem(STORAGE_KEY);
    if (nextRaw) return JSON.parse(nextRaw);

    const legacyRaw = localStorage.getItem("miaoyu-assistant-state-v1");
    return legacyRaw ? JSON.parse(legacyRaw) : {};
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

export function isConversationArray(value: unknown): value is Conversation[] {
  return Array.isArray(value);
}
