import { createHash } from "node:crypto";
import type { BankQuestion } from "./types";

/** IDs, topic labels, ordering numbers, and skill tagging do not define mathematical diversity. */
export function questionFingerprint(q: BankQuestion) {
  return createHash("sha256").update(JSON.stringify({ text: q.questionText, latex: q.latex,
    answer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty,
    answerType: q.answerType, purpose: q.purpose,
    steps: [...q.steps].sort((a, b) => a.order - b.order).map((s) => ({ type: s.type, prompt: s.prompt,
      answer: s.expectedAnswer, options: [...s.options].sort((a, b) => a.order - b.order)
        .map((o) => ({ text: o.text, correct: o.isCorrect })) })) })).digest("hex");
}

export function examFormat(q: BankQuestion): "single_choice_4" | "training" | "invalid_choice" {
  if (q.answerType !== "multiple_choice" || q.steps.length !== 1 || q.steps[0].type !== "multiple_choice") return "training";
  const s = q.steps[0], correct = s.options.filter((o) => o.isCorrect);
  if (s.options.length !== 4 || new Set(s.options.map((o) => o.text.trim())).size !== 4 || correct.length !== 1 ||
    s.expectedAnswer !== correct[0].text || q.correctAnswer !== correct[0].text) return "invalid_choice";
  return "single_choice_4";
}
