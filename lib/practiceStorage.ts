import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { nextReview, studentTimeZone } from "./learningPolicy";

async function saveHelpEvidence(tx: Prisma.TransactionClient, userId: string, questionId: string) {
  const existing = await tx.questionHelp.findUnique({ where: { userId_questionId: { userId, questionId } } });
  if (existing) return;
  await tx.questionHelp.create({ data: { userId, questionId } });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
  const links = await tx.stepSkill.findMany({ where: { step: { questionId } }, select: { skillId: true } });
  for (const skillId of new Set(links.map((s) => s.skillId))) {
    await tx.skillReview.updateMany({ where: { userId, skillId }, data: {
      ...nextReview(new Date(), studentTimeZone(user.timeZone), 0, false), version: { increment: 1 },
    } });
  }
}

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
    await saveHelpEvidence(tx, userId, questionId);
    const hints = await tx.questionStep.findMany({ where: { questionId, hint: { not: null } },
      select: { id: true, hint: true } });
    return { usedHint: true, hints: Object.fromEntries(hints.map((step) => [step.id, step.hint])) };
  }, { maxWait: 10000, timeout: 10000 });
}

export async function recordQuestionHelp(userId: string, questionId: string) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    await saveHelpEvidence(tx, userId, questionId);
    const sessions = await tx.practiceSession.findMany({ where: { userId, status: "active", questionIds: { has: questionId } } });
    for (const session of sessions) if (!session.hintedQuestionIds.includes(questionId)) {
      await tx.practiceSession.update({ where: { id: session.id }, data: { hintedQuestionIds: { push: questionId } } });
    }
  });
}
