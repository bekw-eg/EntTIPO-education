import { Prisma, UserAttempt } from "@prisma/client";
import { PracticeError } from "./practiceStorage";
import { independentCheck, localDay, nextReview, studentTimeZone } from "./learningPolicy";

export async function similarQuestions(tx: Prisma.TransactionClient, userId: string, skillId: string,
  targetDifficulty: number, excluded: string[] = []) {
  const hinted = await tx.practiceSession.findMany({ where: { userId, NOT: { hintedQuestionIds: { isEmpty: true } } },
    select: { hintedQuestionIds: true } });
  const exposedExams = await tx.examSession.findMany({ where: { userId, status: "completed" }, select: { questionIds: true } });
  const candidates = await tx.question.findMany({ where: {
    purpose: { in: ["practice", "verification"] }, id: { notIn: [...excluded, ...hinted.flatMap((s) => s.hintedQuestionIds), ...exposedExams.flatMap((s) => s.questionIds)] },
    difficulty: { gte: Math.max(1, targetDifficulty - 1), lte: Math.min(5, targetDifficulty + 1) },
    skills: { some: { skillId } }, steps: { some: { skills: { some: { skillId } } } },
    attempts: { none: { userId } }, questionHelp: { none: { userId } }, mistakes: { none: { userId } },
    learningChecks: { none: { userId, status: "pending" } },
  }, select: { id: true, difficulty: true, purpose: true }, orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
  return candidates.sort((a, b) => Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty)
    || Number(b.purpose === "verification") - Number(a.purpose === "verification") || a.id.localeCompare(b.id));
}

// Caller holds the account lock. Repeated clicks share the pending check and saved training.
export async function startLearningCheck(tx: Prisma.TransactionClient, userId: string, data: {
  skillId: string; mistakeId?: string | null; preferredQuestionId?: string; excluded?: string[];
  targetDifficulty?: number; purpose?: "confirmation" | "review";
}) {
  const mistake = data.mistakeId ? await tx.mistake.findFirst({ where: { id: data.mistakeId, userId }, include: { question: true } }) : null;
  if (data.mistakeId && !mistake) throw new PracticeError("Mistake not found", 404);
  if (mistake && !mistake.skillId) return null;
  const skillId = mistake?.skillId ?? data.skillId;
  if (!await tx.skill.findUnique({ where: { id: skillId } })) throw new PracticeError("Skill not found", 404);
  const schedule = await tx.skillReview.findUnique({ where: { userId_skillId: { userId, skillId } } });
  const purpose = data.purpose ?? (mistake?.confirmedAt ? "review" : "confirmation");
  if (purpose === "review" && (!schedule || localDay(new Date(), schedule.timeZone) < schedule.dueDay)) {
    throw new PracticeError("Review is not due yet", 409);
  }
  const existing = await tx.learningCheck.findFirst({ where: { userId, skillId, mistakeId: data.mistakeId ?? null,
    purpose, status: "pending", ...(purpose === "review" ? { reviewVersion: schedule!.version } : {}) }, orderBy: { createdAt: "desc" } });
  if (existing) {
    const session = await tx.practiceSession.findFirst({ where: { id: existing.sessionId, userId } });
    if (session?.status === "completed" && !await tx.userAttempt.count({ where: { userId, sessionId: existing.sessionId } })) {
      await tx.practiceSession.update({ where: { id: session.id }, data: { status: "active", completedAt: null, revision: { increment: 1 } } });
    }
    return existing;
  }
  const targetDifficulty = mistake?.question.difficulty ?? data.targetDifficulty ?? 1;
  const candidates = await similarQuestions(tx, userId, skillId, targetDifficulty,
    [...(data.excluded ?? []), ...(mistake ? [mistake.questionId] : [])]);
  const selected = candidates.find((q) => q.id === data.preferredQuestionId) ?? candidates[0];
  if (!selected) return null;
  const session = await tx.practiceSession.create({ data: { userId, mode: "mixed", totalCount: 1, questionIds: [selected.id] } });
  return tx.learningCheck.create({ data: { userId, skillId, mistakeId: data.mistakeId ?? null,
    questionId: selected.id, sessionId: session.id, purpose, targetDifficulty,
    reviewVersion: purpose === "review" ? schedule!.version : null } });
}

async function saveSchedule(tx: Prisma.TransactionClient, attempt: UserAttempt, skillId: string,
  success: boolean, initial: boolean) {
  const previous = await tx.skillReview.findUnique({ where: { userId_skillId: { userId: attempt.userId, skillId } } });
  const user = await tx.user.findUniqueOrThrow({ where: { id: attempt.userId }, select: { timeZone: true } });
  const schedule = nextReview(attempt.createdAt, studentTimeZone(user.timeZone), previous?.intervalIndex ?? 0, success, initial);
  return tx.skillReview.upsert({ where: { userId_skillId: { userId: attempt.userId, skillId } },
    create: { userId: attempt.userId, skillId, ...schedule, lastAttemptId: attempt.id },
    update: { ...schedule, lastAttemptId: attempt.id, version: { increment: 1 } } });
}

/** Same transaction as grading: cannot confirm on viewing, a retry, help or another account's answer. */
export async function recordLearningAttempt(tx: Prisma.TransactionClient, attempt: UserAttempt,
  question: { difficulty: number; steps: { skills: { skillId: string }[] }[] }) {
  const check = await tx.learningCheck.findFirst({ where: { userId: attempt.userId, sessionId: attempt.sessionId,
    questionId: attempt.questionId, status: "pending" }, include: { mistake: true } });
  let outcome: { status: string; mistakeId: string | null; dueDay: string | null } | null = null;
  const adjusted = new Set<string>();
  if (check) {
    const priorAttempts = await tx.userAttempt.count({ where: { userId: attempt.userId, questionId: attempt.questionId, id: { not: attempt.id } } });
    const helped = await tx.questionHelp.findUnique({ where: { userId_questionId: { userId: attempt.userId, questionId: attempt.questionId } } });
    const hinted = await tx.practiceSession.count({ where: { userId: attempt.userId, hintedQuestionIds: { has: attempt.questionId } } });
    const exposedExam = await tx.examSession.count({ where: { userId: attempt.userId, status: "completed", questionIds: { has: attempt.questionId } } });
    const passed = independentCheck({ isCorrect: attempt.isCorrect, usedHint: attempt.usedHint, priorAttempts,
      priorHelp: !!helped || hinted > 0 || exposedExam > 0, questionId: attempt.questionId, originalQuestionId: check.mistake?.questionId,
      testsSkill: question.steps.some((s) => s.skills.some((link) => link.skillId === check.skillId)),
      difficulty: question.difficulty, targetDifficulty: check.targetDifficulty });
    await tx.learningCheck.update({ where: { id: check.id }, data: { status: passed ? "passed" : "failed",
      attemptId: attempt.id, completedAt: attempt.createdAt } });
    if (passed && check.mistakeId) await tx.mistake.updateMany({ where: { id: check.mistakeId, userId: attempt.userId, confirmedAt: null },
      data: { confirmedAt: attempt.createdAt, confirmationAttemptId: attempt.id } });
    const previous = await tx.skillReview.findUnique({ where: { userId_skillId: { userId: attempt.userId, skillId: check.skillId } } });
    // A stale pending review can never advance the same interval twice.
    const currentCycle = check.purpose !== "review" || previous?.version === check.reviewVersion;
    const schedule = currentCycle ? await saveSchedule(tx, attempt, check.skillId, passed, check.purpose === "confirmation") : previous;
    adjusted.add(check.skillId);
    outcome = { status: passed ? "passed" : "failed", mistakeId: check.mistakeId, dueDay: schedule?.dueDay ?? null };
    await tx.learningPlanAction.updateMany({ where: { sessionId: attempt.sessionId, kind: "check", plan: { userId: attempt.userId },
      completedAt: null }, data: passed ? { status: "completed", completedAt: attempt.createdAt } : { status: "retry" } });
  }
  for (const skillId of new Set(question.steps.flatMap((s) => s.skills.map((link) => link.skillId)))) {
    if (adjusted.has(skillId) || (attempt.isCorrect && !attempt.usedHint)) continue;
    if (await tx.skillReview.findUnique({ where: { userId_skillId: { userId: attempt.userId, skillId } } })) {
      await saveSchedule(tx, attempt, skillId, false, false);
    }
  }
  return outcome;
}
