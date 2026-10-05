import { Prisma, type PrismaClient } from "@prisma/client";
import { auditCoverage } from "./coverage";
import type { ExamProfile } from "./profile";

export async function readCoverage(prisma: PrismaClient, profile: ExamProfile, language: 'ru' | 'kk' = 'ru') {
  // Prisma may read nested relations with several statements. Keep all of them
  // on one repeatable snapshot, including during a concurrent bank upgrade.
  const bank = await prisma.$transaction((tx) => tx.question.findMany({ orderBy: { id: "asc" }, include: {
    skills: { select: { skillId: true } }, steps: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
  } }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return auditCoverage(profile, bank, undefined, language);
}
