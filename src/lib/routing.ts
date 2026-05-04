import type { AdvancedSettings, ChatMode, ChatRoute } from "../types";

const complexKeywords = [
  "代码",
  "架构",
  "推理",
  "证明",
  "数学",
  "论文",
  "法律",
  "医疗",
  "财务",
  "投资",
  "策略",
  "分析",
  "debug",
  "algorithm",
  "architecture",
  "compare",
  "reason"
];

const dailyProThreshold = 8;

export function chooseRoute(prompt: string, mode: ChatMode, advanced: AdvancedSettings): ChatRoute {
  if (mode === "advanced") {
    const effortLabel = advanced.reasoningEffort === "max" ? "最大思考" : "深度思考";
    return {
      model: "deepseek-v4-pro",
      thinkingEnabled: true,
      reasoningEffort: advanced.reasoningEffort,
      label: `高级模式 · v4 pro · ${effortLabel}`
    };
  }

  const score = estimateComplexity(prompt);
  const usePro = score >= dailyProThreshold;
  return {
    model: usePro ? "deepseek-v4-pro" : "deepseek-v4-flash",
    thinkingEnabled: false,
    label: usePro ? "每日模式 · 自动选择 v4 pro · 不思考" : "每日模式 · 自动选择 v4 flash · 不思考"
  };
}

export function improvementRoute(): ChatRoute {
  return {
    model: "deepseek-v4-pro",
    thinkingEnabled: true,
    reasoningEffort: "max",
    label: "重新认真思考 · v4 pro · 最大思考"
  };
}

function estimateComplexity(prompt: string) {
  const trimmed = prompt.trim();
  let score = 0;

  if (trimmed.length > 160) score += 1;
  if (trimmed.length > 400) score += 2;
  if (trimmed.length > 900) score += 3;
  if (/```|function |class |interface |SELECT |curl |堆栈|报错|异常|traceback|stack trace/i.test(trimmed)) score += 4;
  if (/[=<>]{2,}|∑|√|积分|矩阵|概率|定理|证明/.test(trimmed)) score += 3;
  if (/法律|医疗|财务|投资|合同|诊断|审计|架构|迁移|性能|安全/.test(trimmed)) score += 2;

  const lower = trimmed.toLowerCase();
  for (const keyword of complexKeywords) {
    if (lower.includes(keyword)) score += 1;
  }

  return score;
}
