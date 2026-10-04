import type { PrismaClient } from '@prisma/client';
import { questionTranslations, questionLocalizationSource, missingQuestionTranslations, translateContent } from '../lib/i18n/content';
import { topicLessons } from '../lib/i18n/lessons';
import { examPointsKk } from '../lib/i18n/exam-content';
import { TIPO_MATH } from '../lib/exam/profile';

/** Updates only localization columns in place. Unknown content aborts the entire transaction. */
export async function seedKazakhContent(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(410044)::text`;
    const topics = await tx.topic.findMany({ include: { lesson: true } });
    for (const topic of topics) {
      const lesson = topicLessons[topic.id]?.kk;
      const extra = topic.id === 'exam_surfaces' ? ['Айналу денелерінің беттері', 'Цилиндр мен конустың элементтері, жазбалары және беттерінің аудандары.'] :
        topic.id === 'exam_volumes' ? ['Денелердің көлемдері', 'Призманың, пирамиданың, цилиндрдің және конустың көлемдері.'] : undefined;
      const nameKk = lesson?.title ?? extra?.[0] ?? topic.nameKk ?? translateContent(topic.name);
      const descriptionKk = lesson?.description ?? extra?.[1] ?? topic.descriptionKk ?? translateContent(topic.description);
      if (!nameKk || !descriptionKk) throw new Error(`Missing topic translation: ${topic.id}`);
      await tx.topic.update({ where: { id: topic.id }, data: { nameKk, descriptionKk } });
      if (topic.lesson && lesson) await tx.lesson.update({ where: { id: topic.lesson.id }, data: { contentKk: { ...lesson } } });
    }
    for (const sub of await tx.subtopic.findMany()) {
      const nameKk = sub.nameKk ?? translateContent(sub.name), descriptionKk = sub.description ? sub.descriptionKk ?? translateContent(sub.description) : null;
      if (!nameKk || (sub.description && !descriptionKk)) throw new Error(`Missing subtopic translation: ${sub.id}`);
      await tx.subtopic.update({ where: { id: sub.id }, data: { nameKk, descriptionKk } });
    }
    for (const p of TIPO_MATH.points) {
      const kk = examPointsKk[p.code];
      await tx.skill.updateMany({ where: { id: { in: p.skills } }, data: {
        nameKk: kk.title, explanationKk: `ҰБТ спецификациясының ${p.code} тармағы: ${kk.title}.`, ruleKk: kk.rule,
      } });
    }
    const questions = await tx.question.findMany({ include: { steps: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } } });
    for (const q of questions) {
      const translated = questionTranslations(q), localizationSource = questionLocalizationSource(q);
      if (q.localizationSource && q.localizationSource !== localizationSource) throw new Error(`Source changed since translation: ${q.id}; review both language versions before updating the source stamp`);
      const missing = missingQuestionTranslations({ ...q, ...translated, localizationSource,
        steps: q.steps.map((s, i) => ({ ...s, ...translated.steps[i], options: s.options.map((o, j) => ({ ...o, ...translated.steps[i].options[j] })) })) });
      if (missing.length) throw new Error(`Missing translations: ${q.id}: ${missing.join(', ')}`);
      await tx.question.update({ where: { id: q.id }, data: { titleKk: translated.titleKk,
        questionTextKk: translated.questionTextKk, explanationKk: translated.explanationKk, localizationSource } });
      for (const [i, step] of q.steps.entries()) {
        await tx.questionStep.update({ where: { id: step.id }, data: { promptKk: translated.steps[i].promptKk, hintKk: translated.steps[i].hintKk } });
        for (const [j, option] of step.options.entries()) await tx.questionOption.update({ where: { id: option.id }, data: translated.steps[i].options[j] });
      }
    }
    return { topics: topics.length, questions: questions.length };
  }, { maxWait: 15000, timeout: 120000 });
}
