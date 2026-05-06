import { useMemo, useState } from "react";
import type { ChatMode, Conversation } from "../types";
import { MODE_CONFIGS, MODE_ORDER } from "../lib/routing";
import { appIcon192 } from "../lib/assets";
import {
  CalculatorIcon,
  CatMark,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CodeIcon,
  FolderIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon
} from "./Icons";

interface ModeFolder {
  mode: ChatMode;
  conversations: Conversation[];
  activeConversationId: string;
}

interface SidebarProps {
  folders: ModeFolder[];
  activeMode: ChatMode;
  collapsed: boolean;
  isOpen: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onModeSelect: (mode: ChatMode) => void;
  onConversationSelect: (mode: ChatMode, id: string) => void;
  onNew: () => void;
  onClearMode: () => void;
  onLogout: () => void;
}

export function Sidebar({
  folders,
  activeMode,
  collapsed,
  isOpen,
  onToggleCollapsed,
  onClose,
  onModeSelect,
  onConversationSelect,
  onNew,
  onClearMode,
  onLogout
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const folderByMode = useMemo(() => new Map(folders.map((folder) => [folder.mode, folder])), [folders]);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${isOpen ? "open" : ""}`} aria-label="对话列表">
      <div className="brand-row">
        <div className="brand-lockup">
          <CatMark className="brand-icon" />
          {!collapsed ? <span>喵语助手</span> : null}
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-button desktop-only" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}>
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
          <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="关闭侧栏">
            <CloseIcon />
          </button>
        </div>
      </div>

      <button className="new-chat-button" type="button" onClick={onNew} title="新建对话">
        <PlusIcon />
        {!collapsed ? "新建对话" : null}
      </button>

      {!collapsed ? (
        <label className="search-box">
          <SearchIcon />
          <input type="search" placeholder="搜索当前模式或历史" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      ) : null}

      <div className="conversation-groups">
        {MODE_ORDER.map((mode) => {
          const config = MODE_CONFIGS[mode];
          const folder = folderByMode.get(mode);
          const conversations = (folder?.conversations || []).filter((conversation) =>
            normalizedQuery ? conversation.title.toLowerCase().includes(normalizedQuery) : true
          );
          const isActiveMode = activeMode === mode;
          const showConversations = !collapsed && (isActiveMode || normalizedQuery.length > 0);

          return (
            <section className={`mode-folder ${isActiveMode ? "active" : ""}`} key={mode}>
              <button className="mode-folder-row" type="button" onClick={() => onModeSelect(mode)} title={config.label}>
                <ModeIcon mode={mode} />
                {!collapsed ? (
                  <>
                    <span>{config.folderLabel}</span>
                    <small>{folder?.conversations.length || 0}</small>
                  </>
                ) : null}
              </button>

              {showConversations ? (
                <div className="mode-conversation-list">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`conversation-row ${conversation.id === folder?.activeConversationId ? "selected" : ""}`}
                      onClick={() => onConversationSelect(mode, conversation.id)}
                    >
                      <CatMark />
                      <span>{conversation.title}</span>
                      <time>{formatShortTime(conversation.updatedAt)}</time>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!collapsed ? (
        <div className="sidebar-footer">
          <button className="icon-button" type="button" onClick={onClearMode} aria-label={`清空${MODE_CONFIGS[activeMode].label}对话`}>
            <TrashIcon />
          </button>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="退出登录">
            <LogOutIcon />
          </button>
          <div className="profile-chip">
            <img src={appIcon192} alt="" />
            <div>
              <strong>皮皮</strong>
              <span>我们可爱的猫猫</span>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function ModeIcon({ mode }: { mode: ChatMode }) {
  if (mode === "math") return <CalculatorIcon />;
  if (mode === "coding") return <CodeIcon />;
  return <FolderIcon />;
}

function formatShortTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
