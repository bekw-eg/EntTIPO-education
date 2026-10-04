import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { missingQuestionTranslations, isLanguageNeutral, translateContent } from '../lib/i18n/content';
import { auditCoverage } from '../lib/exam/coverage';
import { TIPO_MATH } from '../lib/exam/profile';
const prisma = new PrismaClient();
async function main() {
  const [questions, topics, skills, subtopics] = await Promise.all([
    prisma.question.findMany({ include: { skills: true, steps: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } } }),
    prisma.topic.findMany({ include: { lesson: true } }), prisma.skill.findMany(), prisma.subtopic.findMany(),
  ]);
  const missing = questions.flatMap(q => missingQuestionTranslations(q).map(field => `${q.id}.${field}`));
  function check(field: string, source: string | null, value: string | null | undefined) {
    if (!value?.trim() || value === source && !isLanguageNeutral(value) && translateContent(value) !== value) missing.push(field);
  }
  for (const t of topics) {
    check(`topic.${t.id}.nameKk`, t.name, t.nameKk);
    check(`topic.${t.id}.descriptionKk`, t.description, t.descriptionKk);
    if (t.lesson) {
      const kk = t.lesson.contentKk as Record<string, string> | null;
      for (const field of ['title', 'description', 'whatIsIt', 'whenUsed', 'formula', 'formulaLatex', 'example', 'commonErrors']) if (!kk?.[field]?.trim()) missing.push(`lesson.${t.lesson.id}.${field}`);
      for (const field of ['whatIsIt', 'whenUsed', 'example', 'commonErrors'] as const) if (kk?.[field]) check(`lesson.${t.lesson.id}.${field}`, t.lesson[field], kk[field]);
    }
  }
  for (const s of skills) for (const field of ['nameKk', 'explanationKk', 'ruleKk'] as const) if (!s[field]?.trim() || s[field] === s[field.replace('Kk', 'Ru') as 'nameRu'] && !isLanguageNeutral(s[field])) missing.push(`skill.${s.id}.${field}`);
  for (const s of subtopics) { check(`subtopic.${s.id}.nameKk`, s.name, s.nameKk); if (s.description) check(`subtopic.${s.id}.descriptionKk`, s.description, s.descriptionKk); }
  console.log(JSON.stringify({ questions: questions.length, topics: topics.length, lessons: topics.filter(t => t.lesson).length,
    skills: skills.length, subtopics: subtopics.length, missing }, null, 2));
  assert.equal(missing.length, 0, 'Every available teaching field must have an up-to-date Kazakh localization');
  const ru = auditCoverage(TIPO_MATH, questions), kk = auditCoverage(TIPO_MATH, questions, undefined, 'kk');
  assert.equal(kk.readiness.balancedVariant.canGenerate, true, 'Complete Kazakh exam paper cannot be generated');
  assert.deepEqual(kk.questions.filter(q => q.eligible).map(q => q.id), ru.questions.filter(q => q.eligible).map(q => q.id));
  console.log(`Exam coverage RU/KK: ${kk.totals.eligible} eligible questions; 20 points, A/B/C = 5/10/5.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
