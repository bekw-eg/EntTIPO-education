import { Prisma, PrismaClient } from "@prisma/client";
import { DIAGNOSTIC_EXERCISES, PRACTICE_EXERCISES, SKILLS } from "../lib/skillCatalog";
import { DAILY_EXERCISES } from "../lib/dailyLearningBank";
import { seedKazakhContent } from './kazakhSeed';
import { seedPracticeChoices } from './practiceChoiceSeed';

/** Additive and idempotent: never edit existing answers, attempts or legacy mistakes. */
export async function seedSkills(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    // Serialize competing upgrade/seed invocations without modifying the bank.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(410042)::text`;
    for (const skill of SKILLS) {
      await tx.skill.upsert({ where: { id: skill.id }, update: { ...skill }, create: { ...skill } });
    }
    for (const q of [...DIAGNOSTIC_EXERCISES, ...PRACTICE_EXERCISES, ...DAILY_EXERCISES]) {
      await tx.question.upsert({ where: { id: q.id }, update: {}, create: {
        id: q.id, topicId: q.topicId, purpose: q.purpose, title: q.title, titleKk: q.titleKk,
        questionText: q.questionText, questionTextKk: q.questionTextKk,
        explanation: q.explanation, explanationKk: q.explanationKk,
        correctAnswer: q.steps.at(-1)!.expectedAnswer, answerType: "expression", difficulty: q.difficulty,
        skills: { create: [...new Set(q.steps.flatMap((s) => s.skillIds))].map((skillId) => ({ skillId })) },
        steps: { create: q.steps.map((s, index) => ({
          id: `${q.id}_step_${index + 1}`, order: index + 1, type: "expression_input",
          prompt: s.prompt, promptKk: s.promptKk, expectedAnswer: s.expectedAnswer,
          hint: q.purpose !== "diagnostic" ? s.hint : null,
          misconceptions: s.misconceptions as unknown as Prisma.InputJsonValue,
          skills: { create: s.skillIds.map((skillId) => ({ skillId })) },
        })) },
      } });
    }
    // Reviewed original seed IDs: simple arithmetic steps are deliberately untagged.
    for (const [questionId, orders] of [["q2_t1", [1]], ["q3_t1", [1, 3]]] as const) {
      const question = await tx.question.findUnique({ where: { id: questionId }, include: { steps: true } });
      if (!question) continue;
      const expected = questionId === "q2_t1" ? ["Корень из степени"] : ["Сложить показатели при умножении", "x**2"];
      if (orders.some((order, index) => question.steps.find((s) => s.order === order)?.expectedAnswer !== expected[index])) continue;
      await tx.questionSkill.upsert({ where: { questionId_skillId: { questionId, skillId: "power_properties" } }, update: {},
        create: { questionId, skillId: "power_properties" } });
      for (const step of question.steps.filter((s) => (orders as readonly number[]).includes(s.order))) {
        await tx.stepSkill.upsert({ where: { stepId_skillId: { stepId: step.id, skillId: "power_properties" } }, update: {},
          create: { stepId: step.id, skillId: "power_properties" } });
      }
    }
    // Vetted generator signature: property formula, not a title/topic keyword.
    // Numeric addition and final numeric evaluation do not test the property themselves.
    const generatedPropertySteps = await tx.questionStep.findMany({ where: {
      prompt: "Какое базовое свойство степеней применяется для умножения?",
      expectedAnswer: "a^m * a^n = a^(m+n)", type: "multiple_choice",
      question: { topicId: "t1" },
      options: { some: { text: "a^m * a^n = a^(m+n)", isCorrect: true } },
    }, select: { id: true, questionId: true } });
    for (const step of generatedPropertySteps) {
      await tx.questionSkill.upsert({ where: { questionId_skillId: { questionId: step.questionId, skillId: "power_properties" } },
        update: {}, create: { questionId: step.questionId, skillId: "power_properties" } });
      await tx.stepSkill.upsert({ where: { stepId_skillId: { stepId: step.id, skillId: "power_properties" } }, update: {},
        create: { stepId: step.id, skillId: "power_properties" } });
    }
  }, { maxWait: 10000, timeout: 30000 });
  await seedKazakhContent(prisma);
  await seedPracticeChoices(prisma);
}
