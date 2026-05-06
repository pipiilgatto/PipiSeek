import { MODE_ORDER, MODE_CONFIGS } from "../lib/routing";
import type { ChatMode } from "../types";

interface ModeControlsProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

export function ModeControls({ mode, onChange }: ModeControlsProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="使用模式">
      {MODE_ORDER.map((item) => (
        <button
          key={item}
          className={mode === item ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={mode === item}
          onClick={() => onChange(item)}
        >
          {MODE_CONFIGS[item].label}
        </button>
      ))}
    </div>
  );
}
