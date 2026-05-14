import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { pipiCodexPet } from "../lib/assets";
import type { ChatMode } from "../types";
import { BowlIcon, MoonIcon, SparkleIcon } from "./Icons";

type PetMood = "curious" | "thinking" | "happy" | "playful" | "sleepy";

interface PetCare {
  affection: number;
  energy: number;
  lastVisit: number;
}

interface PipiPetProps {
  isBusy: boolean;
  mode: ChatMode;
}

const storageKey = "miaoyu-pipi-pet-v1";

const modeBubble: Record<ChatMode, string> = {
  daily: "Pipi 在桌边陪你。",
  math: "Pipi 正盯着推导。",
  coding: "Pipi 在看光标闪烁。"
};

const moodBubble: Record<PetMood, string> = {
  curious: "Pipi 眨了眨眼。",
  thinking: "Pipi 正等 Codex 回话。",
  happy: "Pipi 收到小鱼干。",
  playful: "Pipi 在追发光粒子。",
  sleepy: "Pipi 缩进蛋壳打盹。"
};

export function PipiPet({ isBusy, mode }: PipiPetProps) {
  const [expanded, setExpanded] = useState(false);
  const [care, setCare] = useState<PetCare>(() => loadPetCare());
  const [mood, setMood] = useState<PetMood>("curious");
  const [drift, setDrift] = useState({ x: 0, y: 0 });

  const effectiveMood: PetMood = isBusy ? "thinking" : care.energy < 26 ? "sleepy" : mood;
  const bubbleText = isBusy ? moodBubble.thinking : mood === "curious" ? modeBubble[mode] : moodBubble[effectiveMood];
  const careSummary = useMemo(() => {
    if (care.affection > 82 && care.energy > 55) return "亲密稳定";
    if (care.energy < 30) return "想休息";
    if (care.affection < 48) return "需要陪伴";
    return "状态不错";
  }, [care.affection, care.energy]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(care));
  }, [care]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCare((current) => ({
        affection: clamp(current.affection - 1, 0, 100),
        energy: clamp(current.energy - (current.energy > 34 ? 1 : 0), 0, 100),
        lastVisit: Date.now()
      }));
    }, 45_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isBusy) return;
    const intervalId = window.setInterval(() => {
      setMood((current) => (current === "curious" ? "happy" : "curious"));
      setDrift({
        x: Math.round(Math.random() * 28 - 14),
        y: Math.round(Math.random() * -14)
      });
    }, 12_000);
    return () => window.clearInterval(intervalId);
  }, [isBusy]);

  const petStyle = {
    "--pipi-drift-x": `${drift.x}px`,
    "--pipi-drift-y": `${drift.y}px`
  } as CSSProperties;

  return (
    <aside className={`pipi-pet mood-${effectiveMood} ${expanded ? "expanded" : ""}`} style={petStyle} aria-label="Pipi Codex pet">
      <button
        className="pipi-stage"
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "收起 Pipi Codex pet" : "打开 Pipi Codex pet"}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="pipi-aura" />
        <img src={pipiCodexPet} alt="Pipi Codex pet" />
        <span className="pipi-bubble">{bubbleText}</span>
        <span className="pipi-particles" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      {expanded ? (
        <section className="pipi-panel" aria-label="Pipi 状态">
          <div>
            <strong>Pipi</strong>
            <span>{careSummary}</span>
          </div>
          <Meter label="亲密" value={care.affection} />
          <Meter label="精力" value={care.energy} />
          <div className="pipi-actions">
            <button type="button" aria-label="喂 Pipi" title="喂 Pipi" onClick={feedPipi}>
              <BowlIcon />
            </button>
            <button type="button" aria-label="陪 Pipi 玩" title="陪 Pipi 玩" onClick={playWithPipi}>
              <SparkleIcon />
            </button>
            <button type="button" aria-label="让 Pipi 休息" title="让 Pipi 休息" onClick={napPipi}>
              <MoonIcon />
            </button>
          </div>
        </section>
      ) : null}
    </aside>
  );

  function feedPipi() {
    setMood("happy");
    setCare((current) => ({
      affection: clamp(current.affection + 8, 0, 100),
      energy: clamp(current.energy + 4, 0, 100),
      lastVisit: Date.now()
    }));
  }

  function playWithPipi() {
    setMood("playful");
    setDrift({
      x: Math.round(Math.random() * 36 - 18),
      y: -18
    });
    setCare((current) => ({
      affection: clamp(current.affection + 10, 0, 100),
      energy: clamp(current.energy - 8, 0, 100),
      lastVisit: Date.now()
    }));
  }

  function napPipi() {
    setMood("sleepy");
    setCare((current) => ({
      affection: clamp(current.affection + 3, 0, 100),
      energy: clamp(current.energy + 16, 0, 100),
      lastVisit: Date.now()
    }));
  }
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <label className="pipi-meter">
      <span>{label}</span>
      <i>
        <b style={{ width: `${value}%` }} />
      </i>
    </label>
  );
}

function loadPetCare(): PetCare {
  const fallback = { affection: 78, energy: 72, lastVisit: Date.now() };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PetCare>;
    const elapsedHours = Math.max(0, (Date.now() - Number(parsed.lastVisit || Date.now())) / 3_600_000);
    return {
      affection: clamp(Number(parsed.affection ?? fallback.affection) - Math.floor(elapsedHours / 6), 0, 100),
      energy: clamp(Number(parsed.energy ?? fallback.energy) + Math.floor(elapsedHours * 3), 0, 100),
      lastVisit: Date.now()
    };
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
