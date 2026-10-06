import { Prisma, PrismaClient } from "@prisma/client";
import { authorPracticeChoice } from "../lib/practiceChoiceBank";

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

/** Additive: no changes to historical answers, official exam content or existing snapshots. */
export async function seedPracticeChoices(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(410044)::text`;
    const questions = await tx.question.findMany({ where: { purpose: { in: ["practice", "verification"] } },
      include: { skills: true, steps: { orderBy: { order: "asc" }, include: { skills: true, options: true } } } });
    let ready = 0;
    const quarantined: string[] = [];
    for (const question of questions) {
      const choice = authorPracticeChoice(question);
      if (!choice) { quarantined.push(question.id); continue; }
      if (canonical(question.practiceChoice) === canonical(choice)) continue;
      await tx.question.update({ where: { id: question.id }, data: { practiceChoice: choice as unknown as Prisma.InputJsonValue } });
      ready++;
    }
    return { ready, quarantined };
  }, { maxWait: 10000, timeout: 60000 });
}
