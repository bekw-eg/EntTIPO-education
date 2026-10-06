import assert from "node:assert/strict";
import katex from "katex";
import { resultReview } from "../lib/resultAnalysis";
import { analysisText } from "../lib/i18n/result-analysis";
import { choiceLatex, choiceStem } from "../lib/choiceDisplay";
import type { AttemptResult, PracticeQuestion } from "../types";

const question: PracticeQuestion = { id: "review", topicId: "t4", subtopicId: null, subtopic: null,
  topic: { id: "t4", name: "Производные", description: "", difficulty: 1, order: 4, createdAt: new Date() },
  latex: null, createdAt: new Date(), answerType: "expression", difficulty: 1,
  title: "Цепное правило", questionText: "Найди производную: (3*x+1)^2",
  questionTextKk: "Туындысын тап: (3*x+1)^2", steps: [1, 2, 3].map(order => ({ id: `s${order}`, order,
    questionId: "review", hasHint: false,
    type: "expression_input", prompt: "Запиши ответ", promptKk: "Жауабыңды жаз", options: [] })) };
const result: AttemptResult = { attemptId: "saved", isCorrect: false, isPartial: false, score: 0,
  explanation: "Внешняя производная: 2(3x+1). Внутренняя: 3. Умножаем: 6(3x+1).",
  explanationKk: "Сыртқы туынды: 2(3x+1). Ішкі туынды: 3. Көбейтеміз: 6(3x+1).",
  errorType: "unclassified", usedHint: false, attemptNumber: 1,
  sessionStats: { totalCount: 1, completedCount: 1, correctCount: 0, attemptCount: 1, correctAttemptCount: 0, mode: "mixed" },
  stepResults: [{ stepId: "s1", stepOrder: 1, isCorrect: false, userAnswer: "wrong-id", expectedAnswer: '["right-id"]', skillIds: ["chain_rule"] }],
  choice: { selectedOptionIds: ["wrong-id"], correctOptionIds: ["right-id"], options: [
    { id: "right-id", text: "6*(3*x+1)" }, { id: "wrong-id", text: "2*(3*x+1)" },
  ], solutionSteps: [] },
};
const before = JSON.stringify(result);
for (const locale of ["ru", "kk", "en"] as const) {
  const review = resultReview(result, question, locale);
  assert.equal(review.failed.length, 1);
  assert.equal(review.items[0].selected[0].text, "2*(3*x+1)");
  assert.equal(review.items[0].expected[0].letter, "A");
  assert.equal(review.sharedFeedback, undefined); // A plausible distractor proves no cause.
  assert.equal(review.hasUnclassified, true);
  assert.equal(review.rules[0].id, "chain_rule");
  for (const label of ["yourAnswer", "correctAnswer", "why", "rule", "retry", "solve"] as const) assert.ok(analysisText[locale][label]);
}
assert.equal(JSON.stringify(result), before, "Presentation must not mutate the saved snapshot");
const authored = { ru: "Ты пропустил внутреннюю производную.", kk: "Ішкі туындыны өткізіп жібердің." };
const marked = { ...result, errorType: "incorrect_method" as const,
  stepResults: [{ ...result.stepResults[0], feedback: authored }] };
assert.equal(resultReview(marked, question, "kk").sharedFeedback, authored.kk);
assert.equal(resultReview({ ...marked, errorType: "unclassified" }, question, "ru").sharedFeedback, undefined);

const legacy = { ...result, choice: undefined, errorType: "concept_error" as const, stepResults: [1, 2, 3].map(order => ({
  stepId: `s${order}`, stepOrder: order, isCorrect: order === 3, userAnswer: "2*x", expectedAnswer: "3*x",
  feedback: { ru: "Ответ не совпадает. По этому ответу нельзя точно определить причину; повтори правило.",
    kk: "Бұл жауаптан қатенің себебін нақты анықтау мүмкін емес; ережені қайтала." },
})) };
const review = resultReview(legacy, question, "ru");
assert.equal(review.failed.length, 2);
assert.equal(review.hasUnclassified, true);
assert.ok(review.items.every(item => !item.feedback));
assert.equal(review.rules.length, 0, "A topic/title must not imply a skill rule");
const mixed = { ...legacy, stepResults: [{ ...legacy.stepResults[0], feedback: authored }, legacy.stepResults[1]] };
assert.equal(resultReview(mixed, question, "ru").sharedFeedback, undefined);
assert.equal(resultReview(mixed, question, "ru").items[0].feedback, authored.ru);

const multi = { ...result, isCorrect: true, errorType: undefined, choice: { ...result.choice!,
  selectedOptionIds: ["right-id", "wrong-id"], correctOptionIds: ["wrong-id", "right-id"] } };
assert.equal(resultReview(multi, question, "ru").items[0].selected.length, 2);
assert.equal(resultReview(multi, question, "ru").items[0].expected.length, 2);
assert.equal(resultReview(multi, question, "ru").failed.length, 0);

assert.equal(choiceLatex("6*(3*x+1)"), "6(3x+1)");
assert.equal(choiceLatex("1/2"), "\\frac{1}{2}");
assert.equal(choiceLatex("x^(3/2)"), "x^{\\frac{3}{2}}");
assert.equal(choiceLatex("a+b/c"), "a+b/c", "Fraction formatting must preserve precedence");
assert.equal(choiceLatex("1/2*x"), "1/2\\cdot x", "A product after division must not become part of the denominator");
assert.equal(choiceLatex("a/-2*x"), "a/-2\\cdot x");
assert.equal(choiceLatex("x^(2*pi)"), "x^{2\\cdot \\pi}", "Nested powers must preserve existing LaTeX commands");
for (const formula of ["(x+1)/(2*x)", "sqrt(1+sqrt(2))/2", "ln(abs(x))+C", "log_2(x)", "(x+1)^(2*(x+3))",
  `7+${"x-x+".repeat(60)}0`, "\\frac{1}{2}"]) katex.renderToString(choiceLatex(formula), { throwOnError: true });
for (const content of [result.explanation, result.explanationKk!, ...resultReview(result, question, "kk").rules.map(rule => rule.text)]) {
  for (const match of choiceStem(content).matchAll(/\$([^$]+)\$/g)) katex.renderToString(match[1], { throwOnError: true });
}
console.log("PASS: saved IDs/letters, one/multiple errors, neutral legacy fallback, explicit authored feedback, no inferred rules, multi-select, RU/KK/EN and KaTeX");
