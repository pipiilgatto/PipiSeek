export type SpeechSupport = {
  recognition: boolean;
  synthesis: boolean;
};

export type MiaoyuSpeechController = {
  stop: () => void;
};

type SpeakOptions = {
  onStart?: () => void;
  onEnd?: () => void;
};

const femaleVoicePatterns = [
  /xiaoxiao|xiaoyi|xiaoqiu|xiaobei|xiaohan|xiaomeng|xiaoshuang|xiaoyan|xiaorui|xiaozhen|xiaoxuan/i,
  /ting-ting|tingting|mei-jia|meijia|huihui|yaoyao|hanhan/i,
  /hiu maan|hiumaan|hiu gaai|hiugaai|li-mu|limu/i,
  /female|woman|girl|女|女士/i
];

const maleVoicePatterns = [
  /yunjian|yunxi|yunyang|yunhao|kangkang|male|man|boy|男|男士/i
];

const naturalVoicePatterns = [
  /premium|enhanced|neural|natural/i,
  /siri|google|microsoft|apple/i
];

type RecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: RecognitionConstructor;
    SpeechRecognition?: RecognitionConstructor;
  }
}

export function getSpeechSupport(): SpeechSupport {
  return {
    recognition: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    synthesis: "speechSynthesis" in window
  };
}

export function createContinuousRecognition(options: {
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onStop: () => void;
}) {
  const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Constructor) return null;

  let shouldKeepListening = false;
  const recognition = new Constructor();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    if (finalText.trim()) options.onFinalText(finalText.trim());
    options.onInterimText(interim.trim());
  };

  recognition.onend = () => {
    if (shouldKeepListening) {
      try {
        recognition.start();
      } catch {
        options.onStop();
      }
    } else {
      options.onStop();
    }
  };

  recognition.onerror = () => undefined;

  return {
    start() {
      shouldKeepListening = true;
      recognition.start();
    },
    stop() {
      shouldKeepListening = false;
      recognition.stop();
    },
    abort() {
      shouldKeepListening = false;
      recognition.abort();
    }
  };
}

export function stopMiaoyuSpeech() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function speakAsMiaoyu(text: string, options: SpeakOptions = {}): MiaoyuSpeechController | null {
  if (!("speechSynthesis" in window)) return null;

  let didSpeak = false;
  let didFinish = false;
  let timeoutId: number | undefined;

  const finish = () => {
    if (didFinish) return;
    didFinish = true;
    window.speechSynthesis.removeEventListener("voiceschanged", speak);
    if (timeoutId) window.clearTimeout(timeoutId);
    options.onEnd?.();
  };

  const speak = () => {
    if (didSpeak || didFinish) return;
    didSpeak = true;
    window.speechSynthesis.removeEventListener("voiceschanged", speak);
    if (timeoutId) window.clearTimeout(timeoutId);

    const spokenText = speechReadableText(text);
    if (!spokenText) {
      finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const preferred = chooseCuteFemaleChineseVoice(window.speechSynthesis.getVoices());
    if (preferred) utterance.voice = preferred;
    utterance.lang = preferred?.lang || "zh-CN";
    utterance.pitch = 1.04;
    utterance.rate = 0.88;
    utterance.volume = 0.94;
    utterance.onstart = () => options.onStart?.();
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length) {
    speak();
    return {
      stop() {
        finish();
        window.speechSynthesis.cancel();
      }
    };
  }

  window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
  timeoutId = window.setTimeout(speak, 600);

  return {
    stop() {
      finish();
      window.speechSynthesis.cancel();
    }
  };
}

function chooseCuteFemaleChineseVoice(voices: SpeechSynthesisVoice[]) {
  let bestVoice: SpeechSynthesisVoice | undefined;
  let bestScore = 0;

  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const identity = `${voice.name} ${voice.lang}`;
  let score = 0;

  if (/^zh-CN/i.test(voice.lang)) score += 45;
  else if (/^zh-(HK|TW|MO)/i.test(voice.lang)) score += 38;
  else if (/^zh/i.test(voice.lang)) score += 28;
  else if (/Chinese|普通话|國語|粤语|中文/i.test(identity)) score += 18;

  if (/Ting|Mei|Xiao|Hui|Yao|Han|Hiu|Li/i.test(identity)) score += 16;
  if (/Samantha|Ava|Zoe|Allison|Susan|Victoria|Karen|Moira|Serena/i.test(identity)) score += 14;
  if (voice.localService) score += 4;

  for (const pattern of naturalVoicePatterns) {
    if (pattern.test(identity)) score += 10;
  }

  for (const pattern of femaleVoicePatterns) {
    if (pattern.test(identity)) score += 70;
  }

  for (const pattern of maleVoicePatterns) {
    if (pattern.test(identity)) score -= 100;
  }

  return score;
}

function speechReadableText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " 代码内容省略 ")
    .replace(/\$\$[\s\S]*?\$\$/g, " 公式 ")
    .replace(/\\\[[\s\S]*?\\\]/g, " 公式 ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " 链接 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>|~=-]+/g, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
