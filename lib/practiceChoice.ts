import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PracticeError } from "./practiceError";

const optionSchema = z.object({
  id: z.string().min(1), text: z.string().min(1), textKk: z.string().nullable().optional(),
  misconception: z.object({ errorType: z.enum(["wrong_formula", "calculation_error", "sign_error", "algebra_error", "domain_error", "concept_error", "incorrect_method"]),
    skillId: z.string().optional(), ru: z.string(), kk: z.string() }).optional(),
});
export const choiceSchema = z.object({
  version: z.literal(1), type: z.enum(["single", "multiple"]),
  options: z.array(optionSchema).length(5), correctOptionIds: z.array(z.string()).min(1).max(4),
  explanation: z.string().min(1), explanationKk: z.string().nullable().optional(),
  questionText: z.string(), questionTextKk: z.string().nullable().optional(), latex: z.string().nullable(),
  skillIds: z.array(z.string()),
  hint: z.object({ ru: z.string(), kk: z.string() }).optional(),
  solutionSteps: z.array(z.object({ prompt: z.string(), promptKk: z.string().nullable().optional(), answer: z.string() })),
}).superRefine((c, ctx) => {
  const ids = new Set(c.options.map(o => o.id));
  if (ids.size !== 5 || new Set(c.options.map(o => o.text.replace(/\s/g, ""))).size !== 5 ||
    new Set(c.correctOptionIds).size !== c.correctOptionIds.length || c.correctOptionIds.some(id => !ids.has(id)) ||
    (c.type === "single" ? c.correctOptionIds.length !== 1 : c.correctOptionIds.length < 2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid choice content" });
  }
});
export type PracticeChoice = z.infer<typeof choiceSchema>;
export const choiceStepId = (questionId: string) => `choice:${questionId}`;

export function parseChoice(value: unknown): PracticeChoice {
  const parsed = choiceSchema.safeParse(value);
  if (!parsed.success) throw new PracticeError("Reviewed choice content is unavailable; apply the content upgrade", 503);
  return parsed.data;
}

export function selection(choice: Pick<PracticeChoice, "type" | "options">, answer: string, allowEmpty = false): string[] {
  let ids: unknown;
  if (choice.type === "single") ids = answer ? [answer] : [];
  else { try { ids = JSON.parse(answer || "[]"); } catch { throw new PracticeError("Invalid selected options", 400); } }
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !choice.options.some(o => o.id === id)) ||
    new Set(ids).size !== ids.length || (!allowEmpty && !ids.length) || (choice.type === "single" && ids.length > 1)) {
    throw new PracticeError("Select valid option identifiers", 400);
  }
  return [...ids].sort() as string[];
}

export function gradeChoice(choice: PracticeChoice, answer: string) {
  const selectedOptionIds = selection(choice, answer);
  return { selectedOptionIds, correctOptionIds: choice.correctOptionIds,
    isCorrect: JSON.stringify(selectedOptionIds) === JSON.stringify([...choice.correctOptionIds].sort()) };
}

export function publicChoiceStep(questionId: string, choice: PracticeChoice, hint?: { ru: string; kk?: string | null }) {
  const id = choiceStepId(questionId);
  return { id, questionId, order: 1, type: choice.type === "single" ? "multiple_choice" : "multiple_select",
    prompt: choice.type === "single" ? "Выберите один правильный ответ" : "Выберите все правильные ответы",
    promptKk: choice.type === "single" ? "Бір дұрыс жауапты таңдаңыз" : "Барлық дұрыс жауаптарды таңдаңыз",
    hasHint: !!hint, ...(hint ? { hint: hint.ru, hintKk: hint.kk } : {}),
    options: choice.options.map((o, order) => ({ id: o.id, stepId: id, text: o.text, textKk: o.textKk, order })),
  };
}

/** Ceiling, never a target: small sessions cannot contain a multiple-answer question. */
export function multiAnswerLimit(count: number, percent = configuredMultiPercent()) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 5) throw new PracticeError("Practice multiple-answer limit must be between 0 and 5 percent", 503);
  return count < 20 ? 0 : Math.floor(count * percent / 100);
}
export function configuredMultiPercent() { return Number(process.env.PRACTICE_MULTI_MAX_PERCENT ?? "5"); }
export function capChoiceQuestions<T extends { id: string; practiceChoice: unknown }>(questions: T[], count: number, percent?: number): T[] {
  const valid = questions.filter(q => choiceSchema.safeParse(q.practiceChoice).success);
  const target = Math.min(count, valid.length);
  const limit = multiAnswerLimit(target, percent);
  let multiple = 0;
  let result = valid.filter(q => parseChoice(q.practiceChoice).type === "single" || multiple++ < limit).slice(0, target);
  // Removing multiple-answer tasks shrinks the denominator; recompute until the actual session fits.
  while (result.filter(q => parseChoice(q.practiceChoice).type === "multiple").length > multiAnswerLimit(result.length, percent)) {
    const allowed = multiAnswerLimit(result.length, percent);
    let kept = 0;
    result = result.filter(q => parseChoice(q.practiceChoice).type === "single" || kept++ < allowed);
  }
  return result;
}

export async function makeChoiceSnapshots(tx: Prisma.TransactionClient, questionIds: string[]) {
  const questions = await tx.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, practiceChoice: true } });
  const multipleCount = questions.filter(q => parseChoice(q.practiceChoice).type === "multiple").length;
  if (multipleCount > multiAnswerLimit(questionIds.length)) throw new PracticeError("Too many multiple-answer questions for this practice", 400);
  const snapshots: Record<string, PracticeChoice> = {};
  for (const id of questionIds) {
    const choice = parseChoice(questions.find(q => q.id === id)?.practiceChoice);
    // Shuffle exactly once. Neutral IDs carry correctness independently of A–E.
    snapshots[id] = shuffleChoice(choice);
  }
  return snapshots as unknown as Prisma.InputJsonValue;
}

function shuffleChoice(choice: PracticeChoice): PracticeChoice {
  const options = [...choice.options];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return { ...choice, options };
}

/** Called under the account lock. Existing sessions retain question IDs, drafts and results. */
export async function sessionChoice(tx: Prisma.TransactionClient, session: { id: string; choiceSnapshots: Prisma.JsonValue }, questionId: string) {
  const snapshots = (session.choiceSnapshots ?? {}) as Record<string, unknown>;
  if (snapshots[questionId]) return parseChoice(snapshots[questionId]);
  const question = await tx.question.findUnique({ where: { id: questionId }, select: { practiceChoice: true } });
  const choice = shuffleChoice(parseChoice(question?.practiceChoice));
  await tx.practiceSession.update({ where: { id: session.id }, data: {
    choiceSnapshots: { ...snapshots, [questionId]: choice } as Prisma.InputJsonValue,
  } });
  return choice;
}

export function optionId(questionId: string, text: string) {
  return createHash("sha256").update(`${questionId}\0${text}`).digest("hex").slice(0, 24);
}
