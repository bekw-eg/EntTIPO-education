import { Prisma } from "@prisma/client";
import { calculateSkillProgress, skillOutcomes } from "./skillMastery";
import { validateExpressionOffline } from "./mathEngine";
import type { Misconception } from "./skillCatalog";

export function explainSkillError(userAnswer: string, expectedAnswer: string, misconceptions: Prisma.JsonValue) {
  const patterns = Array.isArray(misconceptions) ? misconceptions as unknown as Misconception[] : [];
  const match = patterns.find((p) => validateExpressionOffline(userAnswer, p.answer).isEquivalent);
  return match ? { ru: match.ru, kk: match.kk } : {
    ru: `Ответ «${userAnswer}» не совпадает с результатом «${expectedAnswer}». По этому ответу нельзя точно определить причину; повтори правило и реши ещё одно задание.`,
    kk: `«${userAnswer}» жауабы «${expectedAnswer}» нәтижесіне сәйкес келмейді. Бұл жауаптан қатенің себебін нақты анықтау мүмкін емес; ережені қайталап, тағы бір тапсырма шеш.`,
  };
}

export async function refreshSkillProgress(tx: Prisma.TransactionClient, userId: string, skillIds: string[]) {
  for (const skillId of [...new Set(skillIds)]) {
    const observations = await tx.skillObservation.findMany({ where: { userId, skillId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const progress = calculateSkillProgress(observations);
    await tx.userSkillProgress.upsert({ where: { userId_skillId: { userId, skillId } },
      update: progress, create: { userId, skillId, ...progress } });
  }
}

export async function recordPracticeSkills(tx: Prisma.TransactionClient, data: {
  userId: string; attemptId: string; questionId: string; difficulty: number; usedHint: boolean;
  attemptNumber: number; createdAt: Date;
  steps: { id: string; skills: { skillId: string }[] }[];
  stepResults: { stepId: string; isCorrect: boolean }[];
}) {
  const outcomes = skillOutcomes(data.steps, data.stepResults);
  for (const outcome of outcomes) {
    const previous = await tx.skillObservation.count({ where: { userId: data.userId, skillId: outcome.skillId, questionId: data.questionId } });
    await tx.skillObservation.create({ data: { ...outcome, userId: data.userId,
      attemptId: data.attemptId, questionId: data.questionId, difficulty: data.difficulty,
      usedHint: data.usedHint, attemptNumber: Math.max(data.attemptNumber, previous + 1), createdAt: data.createdAt } });
  }
  await refreshSkillProgress(tx, data.userId, outcomes.map((o) => o.skillId));
}

export async function readUserSkills(tx: Prisma.TransactionClient, userId: string) {
  const skills = await tx.skill.findMany({ orderBy: { id: "asc" }, include: {
    topic: { select: { id: true, name: true } },
    observations: { where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  } });
  return skills.map(({ observations, ...skill }) => ({ ...skill, ...calculateSkillProgress(observations),
    recentFailureCount: observations.slice(-10).filter((o) => !o.isCorrect && Date.now() - o.createdAt.getTime() <= 90 * 86400000).length,
  }));
}

/** Every returned task has an explicit link to the requested skill. */
export async function recommendSkillQuestion(tx: Prisma.TransactionClient, userId: string, skillId: string, preferredQuestionId?: string) {
  const questions = await tx.question.findMany({ where: { purpose: "practice", skills: { some: { skillId } } },
    select: { id: true, title: true, titleKk: true, questionText: true, questionTextKk: true, latex: true, difficulty: true,
      attempts: { where: { userId }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
  questions.sort((a, b) => Number(a.attempts.length > 0) - Number(b.attempts.length > 0) ||
    Number(b.id.startsWith("practice_")) - Number(a.id.startsWith("practice_")) || a.difficulty - b.difficulty);
  const question = questions.find((q) => q.id === preferredQuestionId) ?? questions[0];
  if (!question) return null;
  const { attempts: _attempts, ...publicQuestion } = question;
  return publicQuestion;
}
