import type { AdvancedSettings, ChatMode, ThinkingEffort } from "../types";
import { appIcon192 } from "../lib/assets";
import type { SpeechSupport } from "../lib/speech";

interface SettingsPanelProps {
  mode: ChatMode;
  advanced: AdvancedSettings;
  continuousVoiceEnabled: boolean;
  voiceReplyEnabled: boolean;
  apiBaseUrl: string;
  offlineFallbackEnabled: boolean;
  speechSupport: SpeechSupport;
  onAdvancedChange: (settings: AdvancedSettings) => void;
  onContinuousVoiceChange: (enabled: boolean) => void;
  onVoiceReplyChange: (enabled: boolean) => void;
  onApiBaseUrlChange: (value: string) => void;
  onOfflineFallbackChange: (enabled: boolean) => void;
  onReset: () => void;
}

export function SettingsPanel({
  mode,
  advanced,
  continuousVoiceEnabled,
  voiceReplyEnabled,
  apiBaseUrl,
  offlineFallbackEnabled,
  speechSupport,
  onAdvancedChange,
  onContinuousVoiceChange,
  onVoiceReplyChange,
  onApiBaseUrlChange,
  onOfflineFallbackChange,
  onReset
}: SettingsPanelProps) {
  const isAdvanced = mode === "advanced";

  return (
    <aside className={`settings-panel ${isAdvanced ? "expanded" : "folded"}`} aria-label="模型与设置">
      <div className="panel-title">
        <div>
          <strong>模型与设置</strong>
          <span>{mode === "daily" ? "自动选择，默认不思考" : "v4 pro，始终思考"}</span>
        </div>
      </div>

      {!isAdvanced ? (
        <div className="folded-summary">
          <img src={appIcon192} alt="" />
          <span>每日模式</span>
          <small>自动选择 · 不思考</small>
        </div>
      ) : (
        <>
          <section className="settings-section">
            <h2>高级模式</h2>
            <RadioRow
              checked={advanced.reasoningEffort === "high"}
              title="v4 pro · high"
              detail="开启 thinking，适合需要质量但要兼顾速度的回答"
              onClick={() => updateEffort("high")}
            />
            <RadioRow
              checked={advanced.reasoningEffort === "max"}
              title="v4 pro · max"
              detail="默认设置，投入最多推理预算"
              onClick={() => updateEffort("max")}
            />
          </section>
        </>
      )}

      {isAdvanced ? (
        <>
          <section className="settings-section">
            <h2>语音设置</h2>
            <ToggleRow
              title="持续语音"
              detail={speechSupport.recognition ? "默认开启，可使用麦克风连续听写" : "当前浏览器不支持语音识别"}
              checked={continuousVoiceEnabled}
              disabled={!speechSupport.recognition}
              onChange={onContinuousVoiceChange}
            />
            <ToggleRow
              title="喵声朗读"
              detail={speechSupport.synthesis ? "默认关闭，点消息下方喇叭可手动朗读" : "当前浏览器不支持朗读"}
              checked={voiceReplyEnabled}
              disabled={!speechSupport.synthesis}
              onChange={onVoiceReplyChange}
            />
          </section>

          <section className="settings-section">
            <h2>远程访问</h2>
            <label className="api-url-field">
              <span>API 服务地址</span>
              <input
                type="url"
                value={apiBaseUrl}
                placeholder="https://miaoyu.your-domain.com"
                onChange={(event) => onApiBaseUrlChange(event.target.value)}
              />
              <small>GitHub Pages 通过这个 HTTPS 代理调用 DeepSeek，key 只保存在代理服务器。</small>
            </label>
          </section>

          <section className="settings-section">
            <h2>离线与异常</h2>
            <ToggleRow
              title="API 异常时启用离线回复"
              detail="没有网络或 key 未配置时仍可正常闲聊"
              checked={offlineFallbackEnabled}
              onChange={onOfflineFallbackChange}
            />
          </section>

          <button className="reset-button" type="button" onClick={onReset}>
            重置为默认设置
          </button>
        </>
      ) : null}
    </aside>
  );

  function updateEffort(reasoningEffort: ThinkingEffort) {
    onAdvancedChange({ ...advanced, reasoningEffort });
  }
}

interface RadioRowProps {
  checked: boolean;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}

function RadioRow({ checked, title, detail, disabled, onClick }: RadioRowProps) {
  return (
    <button className="setting-row" type="button" disabled={disabled} onClick={onClick}>
      <span className={`radio-dot ${checked ? "checked" : ""}`} />
      <span className="setting-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}

interface ToggleRowProps {
  checked: boolean;
  title: string;
  detail: string;
  disabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

function ToggleRow({ checked, title, detail, disabled, onChange }: ToggleRowProps) {
  return (
    <button className="setting-row" type="button" disabled={disabled} onClick={() => onChange?.(!checked)}>
      <span className="setting-copy toggle-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <span className={`toggle ${checked ? "checked" : ""}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
