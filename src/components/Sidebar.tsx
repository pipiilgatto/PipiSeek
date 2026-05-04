import type { Conversation } from "../types";
import { appIcon192 } from "../lib/assets";
import { CatMark, CloseIcon, PlusIcon, SearchIcon, TrashIcon } from "./Icons";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClear: () => void;
}

export function Sidebar({ conversations, activeId, isOpen, onClose, onSelect, onNew, onClear }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`} aria-label="对话列表">
      <div className="brand-row">
        <div className="brand-lockup">
          <CatMark className="brand-icon" />
          <span>喵语助手</span>
        </div>
        <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="关闭侧栏">
          <CloseIcon />
        </button>
      </div>

      <button className="new-chat-button" type="button" onClick={onNew}>
        <PlusIcon />
        新建对话
      </button>

      <label className="search-box">
        <SearchIcon />
        <input type="search" placeholder="搜索对话" />
      </label>

      <div className="conversation-groups">
        <p className="group-label">最近</p>
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className={`conversation-row ${conversation.id === activeId ? "selected" : ""}`}
            onClick={() => onSelect(conversation.id)}
          >
            <CatMark />
            <span>{conversation.title}</span>
            <time>{formatShortTime(conversation.updatedAt)}</time>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="icon-button" type="button" onClick={onClear} aria-label="清空对话">
          <TrashIcon />
        </button>
        <div className="profile-chip">
          <img src={appIcon192} alt="" />
          <div>
            <strong>皮皮</strong>
            <span>我们可爱的猫猫</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function formatShortTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
