import type { ChatMode } from "../types";

interface ModeControlsProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

export function ModeControls({ mode, onChange }: ModeControlsProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="使用模式">
      <button
        className={mode === "daily" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={mode === "daily"}
        onClick={() => onChange("daily")}
      >
        每日模式
      </button>
      <button
        className={mode === "advanced" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={mode === "advanced"}
        onClick={() => onChange("advanced")}
      >
        高级模式
      </button>
    </div>
  );
}
