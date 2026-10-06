import { Prisma } from "@prisma/client";
import { PracticeError } from "./practiceStorage";
import { summarizeAttempts } from "./practiceStats";
import { assertNoActiveExam } from "./exam/guard";
import { choiceStepId, publicChoiceStep, sessionChoice } from "./practiceChoice";

// Whitelist both exercise and option fields: never send an answer key with a task.
export const practiceQuestionSelect = {
  id: true, topicId: true, subtopicId: true, title: true, questionText: true,
  latex: true, difficulty: true, answerType: true, createdAt: true,
  titleKk: true, questionTextKk: true,
  topic: true, subtopic: true,
  steps: { orderBy: { order: "asc" as const }, select: {
    id: true, questionId: true, order: true, type: true, prompt: true, promptKk: true, hint: true, hintKk: true,
    options: { orderBy: { order: "asc" as const }, select: {
      id: true, stepId: true, text: true, textKk: true, order: true,
    } },
  } },
} satisfies Prisma.QuestionSelect;

type SelectedQuestion = Prisma.QuestionGetPayload<{ select: typeof practiceQuestionSelect }>;

export function publicPracticeQuestion(question: SelectedQuestion, usedHint = false) {
  return { ...question, usedHint, steps: question.steps.map(({ hint, hintKk, ...step }) => ({
    ...step, hasHint: !!hint, ...(usedHint && hint ? { hint, hintKk } : {}),
  })) };
}

export async function readPracticeSnapshot(tx: Prisma.TransactionClient, sessionId: string, userId: string) {
  await assertNoActiveExam(tx, userId);
  const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new PracticeError("Session not found", 404);
  const attempts = await tx.userAttempt.findMany({
    where: { sessionId, userId }, select: { questionId: true, isCorrect: true },
  });
  const questionId = session.questionIds[session.currentIndex];
  const question = questionId ? await tx.question.findUnique({
    where: { id: questionId }, select: practiceQuestionSelect,
  }) : null;
  let result: Prisma.JsonValue | null = null;
  if (session.currentAttemptId && questionId) {
    const attempt = await tx.userAttempt.findFirst({
      where: { id: session.currentAttemptId, sessionId, userId, questionId },
      include: { question: true, stepAnswers: { include: { step: true } } },
    });
    if (attempt) {
      // Existing pre-idempotency attempts can still be reviewed after the upgrade.
      result = attempt.submissionResult ?? {
        attemptId: attempt.id, isCorrect: attempt.isCorrect, isPartial: attempt.isPartial,
        score: attempt.score, usedHint: attempt.usedHint, attemptNumber: attempt.attemptNumber,
        explanation: attempt.question.explanation, explanationKk: attempt.question.explanationKk, correctAnswer: attempt.question.correctAnswer,
        stepResults: attempt.stepAnswers.map((answer) => ({
          stepId: answer.stepId, stepOrder: answer.step.order, userAnswer: answer.answer,
          isCorrect: answer.isCorrect, expectedAnswer: answer.step.expectedAnswer,
        })),
        sessionStats: { ...summarizeAttempts(attempts), totalCount: session.totalCount, mode: session.mode },
      };
    }
  }
  if (result && typeof result === 'object' && !Array.isArray(result) && !("choice" in result) && questionId) {
    const translation = await tx.question.findUnique({ where: { id: questionId }, select: { explanationKk: true } });
    result = { ...result, explanationKk: translation?.explanationKk ?? null };
  }
  const isLegacyResult = !!result && typeof result === "object" && !Array.isArray(result) && !("choice" in result);
  let publicQuestion = question ? publicPracticeQuestion(question, session.hintedQuestionIds.includes(question.id)) : null;
  let draftAnswers = session.draftAnswers;
  if (question && !isLegacyResult && (session.status === "active" || result)) {
    const choice = await sessionChoice(tx, session, question.id);
    publicQuestion = { ...publicPracticeQuestion(question), choiceFormat: true,
      questionText: choice.questionText, questionTextKk: choice.questionTextKk ?? null, latex: choice.latex,
      usedHint: session.hintedQuestionIds.includes(question.id),
      steps: [{ ...publicChoiceStep(question.id, choice, session.hintedQuestionIds.includes(question.id) && choice.hint ? choice.hint : undefined),
        hasHint: !!choice.hint }] } as typeof publicQuestion;
    const drafts = session.draftAnswers as Record<string, string>;
    draftAnswers = drafts[choiceStepId(question.id)] ? { [choiceStepId(question.id)]: drafts[choiceStepId(question.id)] } : {};
  }
  return {
    id: session.id, status: session.status, mode: session.mode,
    totalCount: session.totalCount, ...summarizeAttempts(attempts),
    startedAt: session.startedAt, completedAt: session.completedAt,
    questionIds: session.questionIds, currentIndex: session.currentIndex,
    revision: session.revision, draftAnswers,
    question: publicQuestion,
    result,
  };
}
