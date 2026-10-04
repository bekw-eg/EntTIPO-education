import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PracticeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Serialize progress, submissions and hint updates for an account across server processes. */
export async function lockAccount(tx: Prisma.TransactionClient, userId: string) {
  const accounts = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  if (accounts.length === 0) throw new PracticeError("Account not found", 401);
}

export async function recordHintUsage(userId: string, sessionId: string, questionId: string) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new PracticeError("Session not found", 404);
    if (session.status !== "active") throw new PracticeError("Session is already completed", 409);
    const question = await tx.question.findUnique({ where: { id: questionId }, select: { topicId: true } });
    if (!question) throw new PracticeError("Question not found", 404);
    if (session.topicId && question.topicId !== session.topicId) {
      throw new PracticeError("Question does not match the session topic", 400);
    }
    if (!session.questionIds.includes(questionId)) {
      throw new PracticeError("Question is not part of this session", 400);
    }
    if (!session.hintedQuestionIds.includes(questionId)) {
      await tx.practiceSession.update({
        where: { id: sessionId, userId },
        data: { hintedQuestionIds: { push: questionId } },
      });
    }
    const hints = await tx.questionStep.findMany({ where: { questionId, hint: { not: null } },
      select: { id: true, hint: true } });
    return { usedHint: true, hints: Object.fromEntries(hints.map((step) => [step.id, step.hint])) };
  }, { maxWait: 10000, timeout: 10000 });
}
