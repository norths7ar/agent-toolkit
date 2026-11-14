export const DEFAULT_PROMPT = '请阅读以上讨论，给出你的看法。';

export function composePrompt(defaultPrompt, question) {
  const base = defaultPrompt.trim();
  const input = question.trim();
  if (!base) return input;
  return input ? `${base}\n\n请围绕以下问题回答：\n${input}` : base;
}
