import type { PrismaClient } from "@prisma/client";
import { EXAM_EXERCISES, exerciseQuestion } from "../lib/exam/bank";
import { TIPO_MATH } from "../lib/exam/profile";
import { CONTENT_REVIEWS, validateReviewReferences } from "../lib/exam/reviews";
import { questionFingerprint } from "../lib/exam/fingerprint";
import { EXAM_RULES } from "../lib/exam/rules";
import { examPointsKk } from '../lib/i18n/exam-content';
import { seedKazakhContent } from './kazakhSeed';
import { seedPracticeChoices } from './practiceChoiceSeed';

/** Additive, serialized, stable IDs. Preserve every existing question and its attempt history. */
export async function seedExamBank(prisma: PrismaClient) {
  validateReviewReferences();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(410043)::text`;
    for (const [id, name, order] of [["exam_surfaces", "Поверхности тел вращения", 16], ["exam_volumes", "Объёмы тел", 17]] as const) {
      await tx.topic.upsert({ where: { id }, update: {}, create: { id, name, order,
        description: "Учебные задания по подтверждённым пунктам спецификации ЕНТ ТиПО B057; покрытие показано в отдельном отчёте." } });
    }
    for (const p of TIPO_MATH.points) {
      for (const id of p.skills) await tx.skill.upsert({ where: { id }, update: { ruleRu: EXAM_RULES[p.code], nameKk: examPointsKk[p.code].title, ruleKk: examPointsKk[p.code].rule }, create: {
        id, topicId: p.topicId, nameRu: p.title, nameKk: examPointsKk[p.code].title,
        explanationRu: `Пункт ${p.code}: ${p.title}.`, explanationKk: `ҰТО: ${p.code}. ${examPointsKk[p.code].title}.`,
        ruleRu: EXAM_RULES[p.code],
        ruleKk: examPointsKk[p.code].rule,
      } });
    }
    for (const exercise of EXAM_EXERCISES) {
      const q = exerciseQuestion(exercise);
      const existing = await tx.question.findUnique({ where: { id: q.id }, include: { skills: true, steps: { include: { options: true } } } });
      if (existing && questionFingerprint(existing) !== questionFingerprint(q)) throw new Error(`Seed content conflict: ${q.id}; review existing content before upgrading`);
      await tx.question.upsert({ where: { id: q.id }, update: {}, create: {
        id: q.id, topicId: q.topicId, title: q.title, questionText: q.questionText, answerType: q.answerType,
        correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty, purpose: q.purpose,
        skills: { create: q.skills }, steps: { create: q.steps.map((s) => ({ ...s, id: `${q.id}_step_1`,
          skills: { create: q.skills }, options: { create: s.options.map((o) => ({ ...o, id: `${q.id}_option_${o.order}` })) } })) },
      } });
    }
    const byHash = new Map(CONTENT_REVIEWS.filter((r) => r.profileId === TIPO_MATH.id && r.profileVersion === TIPO_MATH.version).map((r) => [r.contentHash, r]));
    const bank = await tx.question.findMany({ include: { skills: true, steps: { include: { options: true } } } });
    for (const q of bank) {
      const review = byHash.get(questionFingerprint(q));
      if (review?.quality !== "direct") continue;
      for (const skillId of review.skillIds) {
        await tx.questionSkill.upsert({ where: { questionId_skillId: { questionId: q.id, skillId } }, update: {}, create: { questionId: q.id, skillId } });
        // Legacy multi-step work has not been reviewed at the micro-step level. Tag only
        // the single complete authored exam task, preserving previous step-level evidence.
        if (q.steps.length === 1 && EXAM_EXERCISES.some((e) => e.id === q.id)) {
          const stepId = q.steps[0].id;
          await tx.stepSkill.upsert({ where: { stepId_skillId: { stepId, skillId } }, update: {}, create: { stepId, skillId } });
        }
      }
    }
  }, { maxWait: 10000, timeout: 60000 });
  await seedKazakhContent(prisma);
  await seedPracticeChoices(prisma);
}
