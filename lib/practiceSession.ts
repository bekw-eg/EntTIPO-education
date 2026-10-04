import { Prisma } from "@prisma/client";
import { PracticeError } from "./practiceStorage";
import { summarizeAttempts } from "./practiceStats";

// Whitelist both exercise and option fields: never send an answer key with a task.
export const practiceQuestionSelect = {
  id: true, topicId: true, subtopicId: true, title: true, questionText: true,
  latex: true, difficulty: true, answerType: true, createdAt: true,
  titleKk: true, questionTextKk: true,
  topic: true, subtopic: true,
  steps: { orderBy: { order: "asc" as const }, select: {
    id: true, questionId: true, order: true, type: true, prompt: true, promptKk: true, hint: true,
    options: { orderBy: { order: "asc" as const }, select: {
      id: true, stepId: true, text: true, order: true,
    } },
  } },
} satisfies Prisma.QuestionSelect;

type SelectedQuestion = Prisma.QuestionGetPayload<{ select: typeof practiceQuestionSelect }>;

export function publicPracticeQuestion(question: SelectedQuestion, usedHint = false) {
  return { ...question, usedHint, steps: question.steps.map(({ hint, ...step }) => ({
    ...step, hasHint: !!hint, ...(usedHint && hint ? { hint } : {}),
  })) };
}

export async function readPracticeSnapshot(tx: Prisma.TransactionClient, sessionId: string, userId: string) {
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
        explanation: attempt.question.explanation, correctAnswer: attempt.question.correctAnswer,
        stepResults: attempt.stepAnswers.map((answer) => ({
          stepId: answer.stepId, stepOrder: answer.step.order, userAnswer: answer.answer,
          isCorrect: answer.isCorrect, expectedAnswer: answer.step.expectedAnswer,
        })),
        sessionStats: { ...summarizeAttempts(attempts), totalCount: session.totalCount, mode: session.mode },
      };
    }
  }
  return {
    id: session.id, status: session.status, mode: session.mode,
    totalCount: session.totalCount, ...summarizeAttempts(attempts),
    startedAt: session.startedAt, completedAt: session.completedAt,
    questionIds: session.questionIds, currentIndex: session.currentIndex,
    revision: session.revision, draftAnswers: session.draftAnswers,
    question: question ? publicPracticeQuestion(question, session.hintedQuestionIds.includes(question.id)) : null,
    result,
  };
}
