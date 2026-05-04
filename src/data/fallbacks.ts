const fallbackOpeners = [
  "喵～DeepSeek 现在没有连上，我先用离线模式陪你聊。",
  "喵～网络或 API 暂时有点问题，我先给你一个本地回复。",
  "喵～我现在联系不上云端模型，不过基础聊天还可以继续。"
];

const jokes = [
  "冷笑话一则：为什么键盘很少生气？因为它有很多退格键，可以把情绪退回去。",
  "有只猫去面试，老板问它会什么。它说：我会把任何会议变成喵议。",
  "程序员养猫后最大的改变：bug 还在，但键盘上多了一层毛茸茸的测试覆盖率。"
];

const comfort = [
  "先深呼吸一下。我们可以把事情拆成三步：现在最急的是什么、能立刻做的小动作是什么、剩下的什么时候再处理。",
  "如果你只是想有人陪你说几句，我在这里。现在可以先不用解决所有问题，只要把最卡住的一点说出来就好。"
];

const daily = [
  "我建议先从最小行动开始：写下一句话目标，然后设置一个 10 分钟计时器。做完再决定要不要继续。",
  "可以先给自己一个低门槛版本：今天只完成最重要的一小块，不追求一次做完。"
];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function getOfflineFallback(prompt: string, reason?: string) {
  const normalized = prompt.trim().toLowerCase();
  const opener = fallbackOpeners[Math.floor(Math.random() * fallbackOpeners.length)];
  let body = daily[Math.floor(Math.random() * daily.length)];

  if (includesAny(normalized, ["笑话", "joke", "好笑", "逗我"])) {
    body = jokes[Math.floor(Math.random() * jokes.length)];
  } else if (includesAny(normalized, ["难过", "焦虑", "压力", "失眠", "不开心", "累"])) {
    body = comfort[Math.floor(Math.random() * comfort.length)];
  } else if (includesAny(normalized, ["你好", "早", "晚安", "hello", "hi"])) {
    body = "见到你很开心。今天想轻松聊聊天，还是要我帮你整理一件具体的事？";
  }

  const hint = reason ? `\n\n提示：${reason}` : "";
  return `${opener}\n\n${body}${hint}`;
}
