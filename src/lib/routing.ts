import type { ChatMode, ChatRoute, ModeConfig } from "../types";

export const MODE_ORDER: ChatMode[] = ["daily", "math", "coding"];

export const MODE_CONFIGS: Record<ChatMode, ModeConfig> = {
  daily: {
    mode: "daily",
    label: "每日模式",
    shortLabel: "日常",
    folderLabel: "每日任务",
    headline: "每日模式",
    description: "日常计划、写作、翻译、沟通与生活决策。默认 v4 flash，不思考；复杂问题自动切 v4 pro，不思考。",
    welcome:
      "喵～这里是每日模式。\n\n我会帮你处理日常问题、写作润色、翻译整理、计划安排和轻量分析。默认使用 v4 flash 且不启用 thinking；如果问题明显复杂或有风险，我会自动切到 v4 pro，仍保持不思考来保证速度。",
    systemPrompt: [
      "你是喵语助手的每日模式，一个中文私人助理。",
      "目标：高效处理日常任务、写作、翻译、计划、沟通、生活决策、轻量知识问答。",
      "回答风格：自然、温和、具体、可靠；优先给可执行建议；不要为了卖萌牺牲清晰度。",
      "复杂问题：先拆解再回答，但不要展示冗长推理过程；必要时标注假设和不确定性。",
      "安全边界：涉及医疗、法律、财务等高影响领域时，给一般性信息和风险提示，提醒用户找专业人士。",
      "格式：使用清晰 Markdown，必要时用标题、短列表、表格和行动步骤。"
    ].join("\n")
  },
  math: {
    mode: "math",
    label: "数理模式",
    shortLabel: "数理",
    folderLabel: "数理推导",
    headline: "数理模式",
    description: "逻辑、数学、物理、证明和复杂计算。固定 v4 pro，thinking 开启，reasoning effort 为 high。",
    welcome:
      "喵～这里是数理模式。\n\n我会更重视定义、假设、推导链和检验。适合数学证明、物理建模、逻辑题、公式推导和复杂计算；模型固定为 v4 pro，开启 thinking，reasoning effort 为 high。",
    systemPrompt: [
      "你是喵语助手的数理模式，一个严谨的中文数理推理助手。",
      "目标：解决数学、物理、逻辑、统计、算法理论和形式化推导问题。",
      "工作方式：先明确已知量、目标、约束和需要证明/求解的对象；按步骤推导；每一步说明依据。",
      "数学表达：优先使用 LaTeX Markdown；保持符号一致；必要时给出单位、量纲、边界条件和近似条件。",
      "验证：结尾检查答案是否满足原条件，指出可能的特殊情况、误差来源或替代方法。",
      "遇到题目不完整时，先列出缺失条件，再在合理假设下继续。"
    ].join("\n")
  },
  coding: {
    mode: "coding",
    label: "编程模式",
    shortLabel: "编程",
    folderLabel: "工程开发",
    headline: "编程模式",
    description: "代码、调试、架构、agent 与应用开发。固定 v4 pro，thinking 开启，reasoning effort 为 max。",
    welcome:
      "喵～这里是编程模式。\n\n我会按工程任务来处理：先明确目标和约束，再给实现方案、代码、测试和风险点。适合 app 开发、agent 工作流、架构设计、调试和代码审查；模型固定为 v4 pro，开启 thinking，reasoning effort 为 max。",
    systemPrompt: [
      "你是喵语助手的编程模式，一个务实、严谨的中文资深软件工程助手。",
      "目标：帮助用户完成代码实现、调试、架构设计、agent/app 开发、测试、部署和代码审查。",
      "回答方式：先给结论或行动路径，再给关键代码/命令/文件结构；避免空泛建议。",
      "工程质量：关注安全、可维护性、边界情况、性能、测试覆盖、回滚和部署风险。",
      "代码输出：使用带语言标识的 Markdown 代码块；给出最小可运行片段或清晰补丁说明；必要时说明验证命令。",
      "如果信息不足，先基于合理假设推进，并明确哪些假设需要用户确认。"
    ].join("\n")
  }
};

const complexKeywords = [
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
  "合同",
  "审计",
  "debug",
  "algorithm",
  "architecture",
  "compare",
  "reason",
  "proof"
];

const dailyProThreshold = 8;

export function chooseRoute(prompt: string, mode: ChatMode): ChatRoute {
  const config = MODE_CONFIGS[mode];

  if (mode === "math") {
    return {
      mode,
      model: "deepseek-v4-pro",
      thinkingEnabled: true,
      reasoningEffort: "high",
      label: "数理模式 · v4 pro · 深度思考",
      systemPrompt: config.systemPrompt
    };
  }

  if (mode === "coding") {
    return {
      mode,
      model: "deepseek-v4-pro",
      thinkingEnabled: true,
      reasoningEffort: "max",
      label: "编程模式 · v4 pro · 最大思考",
      systemPrompt: config.systemPrompt
    };
  }

  const score = estimateComplexity(prompt);
  const usePro = score >= dailyProThreshold;
  return {
    mode,
    model: usePro ? "deepseek-v4-pro" : "deepseek-v4-flash",
    thinkingEnabled: false,
    label: usePro ? "每日模式 · 自动 v4 pro · 不思考" : "每日模式 · v4 flash · 不思考",
    systemPrompt: config.systemPrompt
  };
}

export function improvementRoute(mode: ChatMode): ChatRoute {
  if (mode === "daily") {
    return {
      mode,
      model: "deepseek-v4-pro",
      thinkingEnabled: false,
      label: "每日模式 · 重新认真回答 · v4 pro · 不思考",
      systemPrompt: MODE_CONFIGS.daily.systemPrompt
    };
  }

  return chooseRoute("请重新严谨回答上一条问题。", mode);
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
