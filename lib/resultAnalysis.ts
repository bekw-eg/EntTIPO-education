import type { AttemptResult, PracticeQuestion, StepResult } from "@/types";
import type { Locale } from "./i18n/types";
import { answerText, contentText } from "./i18n/content";
import { SKILLS } from "./skillCatalog";

export interface ReviewAnswer { id: string; text: string; letter?: string }
export interface ReviewItem {
  id: string; order: number; isCorrect: boolean; prompt?: string;
  selected: ReviewAnswer[]; expected: ReviewAnswer[]; feedback?: string;
}

// Old step snapshots contain a known neutral fallback, not an authored diagnosis.
function authoredFeedback(step: StepResult, result: AttemptResult, locale: Locale) {
  if (!step.feedback || step.isCorrect || result.errorType === "unclassified") return undefined;
  if (step.feedback.ru.includes("По этому ответу нельзя точно определить причину") ||
      step.feedback.kk.includes("қатенің себебін нақты анықтау мүмкін емес")) return undefined;
  return contentText(step.feedback.ru, step.feedback.kk, locale);
}

function legacyAnswers(value: string, step: PracticeQuestion["steps"][number] | undefined, locale: Locale): ReviewAnswer[] {
  if (step?.type === "multiple_select") {
    try {
      const ids: unknown = JSON.parse(value);
      if (Array.isArray(ids) && ids.every(id => typeof id === "string")) {
        return ids.map(id => ({ id, text: answerText(id, step, locale) }));
      }
    } catch { /* Historical text answers remain readable. */ }
  }
  return [{ id: "answer", text: value ? answerText(value, step, locale) : "—" }];
}

/** Presentation only: correctness and IDs always come from the saved server result. */
export function resultReview(result: AttemptResult, question: PracticeQuestion, locale: Locale) {
  let items: ReviewItem[];
  if (result.choice) {
    const choice = result.choice;
    const answers = (ids: string[]) => choice.options.flatMap((option, index) => ids.includes(option.id)
      ? [{ id: option.id, text: contentText(option.text, option.textKk, locale), letter: String.fromCharCode(65 + index) }] : []);
    const feedback = result.stepResults.map(step => authoredFeedback(step, result, locale)).find(Boolean);
    items = [{ id: question.id, order: 1, isCorrect: result.isCorrect,
      selected: answers(choice.selectedOptionIds), expected: answers(choice.correctOptionIds), feedback }];
  } else {
    items = result.stepResults.map(sr => {
      const step = question.steps.find(s => s.id === sr.stepId);
      return { id: sr.stepId, order: sr.stepOrder, isCorrect: sr.isCorrect,
        prompt: contentText(step?.prompt, step?.promptKk, locale),
        selected: legacyAnswers(sr.userAnswer, step, locale), expected: legacyAnswers(sr.expectedAnswer, step, locale),
        feedback: authoredFeedback(sr, result, locale) };
    });
  }
  const failed = items.filter(item => !item.isCorrect);
  const relevantSteps = result.isCorrect ? result.stepResults : result.stepResults.filter(step => !step.isCorrect);
  const skillIds = new Set(relevantSteps.flatMap(step => step.skillIds ?? []));
  const rules = SKILLS.filter(skill => skillIds.has(skill.id)).map(skill => ({ id: skill.id,
    name: contentText(skill.nameRu, skill.nameKk, locale), text: contentText(skill.ruleRu, skill.ruleKk, locale) }));
  // A shared cause is shown only if every failed item has the same explicit feedback.
  const sharedFeedback = failed.length > 0 && failed.every(item => item.feedback && item.feedback === failed[0].feedback)
    ? failed[0].feedback : undefined;
  return { items, failed, rules, sharedFeedback, hasUnclassified: failed.some(item => !item.feedback),
    explanation: contentText(result.explanation, result.explanationKk, locale) };
}
