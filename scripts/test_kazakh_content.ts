import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { seedKazakhContent } from '../prisma/kazakhSeed';
import { missingQuestionTranslations } from '../lib/i18n/content';
import { TIPO_MATH } from '../lib/exam/profile';
import { questionFingerprint } from '../lib/exam/fingerprint';
import { readExamAvailability } from '../lib/exam/session';
import { readCoverage } from '../lib/exam/database';
import type { PaperQuestion } from '../lib/exam/mode';

const prisma = new PrismaClient();
const base = process.env.KAZAKH_TEST_BASE_URL ?? 'http://127.0.0.1:3100';
const accounts: { id: string; email: string; cookie: string }[] = [];
let damaged: { id: string; questionTextKk: string | null } | null = null;
async function api(path: string, cookie?: string, method = 'GET', body?: unknown, language = 'kk') {
  const response = await fetch(`${base}${path}`, { method,
    headers: { 'x-ent-locale': language, ...(cookie ? { cookie: `${cookie}; ent_tipo_locale=${language}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  return { status: response.status, data: await response.json(), response };
}
async function register(label: string) {
  const email = `kazakh-content-${label}-${randomUUID()}@example.test`;
  const r = await api('/api/auth/register', undefined, 'POST', { name: label, email, password: 'kazakh-check-password-123' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const account = { id: r.data.user.id as string, email, cookie: r.response.headers.get('set-cookie')!.split(';')[0] };
  accounts.push(account); return account;
}
const bank = () => prisma.question.findMany({ orderBy: { id: 'asc' }, include: { skills: true,
  steps: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } } });
async function userData(userId: string) {
  return { sessions: await prisma.practiceSession.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    attempts: await prisma.userAttempt.findMany({ where: { userId }, orderBy: { id: 'asc' }, include: { stepAnswers: { orderBy: { id: 'asc' } } } }),
    mistakes: await prisma.mistake.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    topicProgress: await prisma.userTopicProgress.findMany({ where: { userId } }),
    skillProgress: await prisma.userSkillProgress.findMany({ where: { userId }, orderBy: { skillId: 'asc' } }),
    observations: await prisma.skillObservation.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    diagnostics: await prisma.diagnosticSession.findMany({ where: { userId } }),
    plans: await prisma.dailyLearningPlan.findMany({ where: { userId }, include: { actions: { orderBy: { id: 'asc' } } } }),
    exams: await prisma.examSession.findMany({ where: { userId }, orderBy: { id: 'asc' } }) };
}
async function main() {
  assert.equal((await api('/api/exams')).status, 401);
  const a = await register('KK'), b = await register('RU'), c = await register('missing');
  const initial = await bank();
  assert.ok(initial.length > 0);
  initial.forEach(q => assert.deepEqual(missingQuestionTranslations(q), [], q.id));
  // A Kazakh paper is frozen with canonical IDs/option order; locale changes do not rewrite the timer or answers.
  const settings = { requestId: randomUUID(), profileId: TIPO_MATH.id, profileVersion: TIPO_MATH.version, language: 'kk', durationMinutes: 40 };
  const exam = await api('/api/exams', a.cookie, 'POST', settings);
  assert.equal(exam.status, 200, JSON.stringify(exam.data)); assert.equal(exam.data.language, 'kk');
  const examRecord = await prisma.examSession.findUniqueOrThrow({ where: { id: exam.data.id } });
  const paper = examRecord.paper as unknown as PaperQuestion[];
  assert.equal(paper.length, 20); assert.equal(new Set(paper.map(q => q.pointCode)).size, 20);
  for (const q of paper) {
    const source = initial.find(source => source.id === q.id)!;
    assert.equal(q.questionText, source.questionTextKk); assert.equal(q.explanation, source.explanationKk);
    assert.deepEqual(q.options, source.steps[0].options.map(o => o.textKk));
    assert.equal(q.correctIndex, source.steps[0].options.findIndex(o => o.isCorrect));
    assert.equal(q.latex, source.latex); assert.equal(q.contentHash, questionFingerprint(source));
  }
  const answers = Object.fromEntries(paper.slice(0, 17).map((q, i) => [q.id, i < 12 ? q.correctIndex : (q.correctIndex + 1) % 4]));
  const examPath = `/api/exams/${exam.data.id}`;
  const examSave = await api(examPath, a.cookie, 'PATCH', { requestId: randomUUID(), revision: exam.data.revision,
    currentIndex: 8, answers, flaggedQuestionIds: [paper[8].id] });
  assert.equal(examSave.status, 200);
  const languageSwitch = await api(examPath, a.cookie, 'GET', undefined, 'ru');
  for (const field of ['currentIndex', 'answers', 'flaggedQuestionIds', 'revision', 'deadlineAt', 'language', 'questions']) assert.deepEqual(languageSwitch.data[field], examSave.data[field], field);
  const finished = await api(`${examPath}/finish`, a.cookie, 'POST', {});
  assert.equal(finished.status, 200); assert.equal(finished.data.result.points, 12); assert.equal(finished.data.result.skipped, 3);
  finished.data.result.gaps.forEach((g: any) => assert.match(g.action, /тармағының/));
  assert.match(finished.data.result.masteryPolicy, /Емтихан/);
  assert.deepEqual((await api(examPath, a.cookie, 'GET', undefined, 'ru')).data.result, finished.data.result);

  // Replay both additive DDL and filling; every existing student record, scoring key and ID stays intact.
  const before = await userData(a.id);
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--file',
    'prisma/updates/20261005_kazakh_learning_content.sql', '--schema', 'prisma/schema.prisma'], { stdio: 'pipe' });
  await seedKazakhContent(prisma); await seedKazakhContent(prisma);
  assert.deepEqual(await userData(a.id), before);
  assert.deepEqual((await bank()).map(q => [q.id, questionFingerprint(q)]), initial.map(q => [q.id, questionFingerprint(q)]));
  assert.equal(await prisma.question.count(), initial.length);

  // Reserve every other point-16 question for C, simulating legacy history.
  const point16 = await prisma.$transaction(tx => readExamAvailability(tx,TIPO_MATH,'ru'));
  await prisma.examSession.create({data:{userId:c.id,startRequestId:randomUUID(),startHash:'legacy',
    profileId:TIPO_MATH.id,profileVersion:TIPO_MATH.version,profileSnapshot:JSON.parse(JSON.stringify(TIPO_MATH)),
    language:'ru',status:'completed',startedAt:new Date(0),deadlineAt:new Date(1),durationMinutes:40,
    paper:[],questionIds:point16.candidates.filter(q=>q.pointCode==='16'&&q.id!=='exam_v1_ode_repeated_initial').map(q=>q.id),result:{points:0,maxPoints:20}}});
  damaged = await prisma.question.findUniqueOrThrow({ where: { id: 'exam_v1_ode_repeated_initial' }, select: { id: true, questionTextKk: true } });
  await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: null } });
  const refused = await api('/api/exams', c.cookie, 'POST', { ...settings, requestId: randomUUID() });
  assert.equal(refused.status, 422); assert.match(refused.data.error, /тапсырмалар/); assert.match(refused.data.error, /16/);
  const kkCoverage = await readCoverage(prisma,TIPO_MATH,'kk');
  assert.equal(kkCoverage.questions.find((q: any) => q.id === damaged!.id)!.eligible, false);
  const ruCoverage = await readCoverage(prisma,TIPO_MATH,'ru');
  assert.equal(ruCoverage.questions.find((q: any) => q.id === damaged!.id)!.eligible, true);
  await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: damaged.questionTextKk } }); damaged = null;
  const russian = await api('/api/exams',c.cookie,'POST',{...settings,requestId:randomUUID(),language:'ru'},'ru');
  assert.equal(russian.status,200);
  assert.equal((await api('/api/ai/tutor',c.cookie,'POST',{action:'unknown',language:'kk'})).status,410);
  console.log('PASS: complete RU/KK translations, frozen Kazakh paper, save/language-switch parity, 12/20 scoring, additive localization replay preserves history, untranslated-topic refusal, Russian availability and retired AI API.');

}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (damaged) await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: damaged.questionTextKk } });
  for (const account of accounts) if (await prisma.user.findFirst({ where: { id: account.id, email: account.email } })) {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`DELETE FROM "ExamBankAudit" WHERE "userId"=${account.id}`;
      await tx.mistake.deleteMany({ where: { userId: account.id } });
      await tx.userStepAnswer.deleteMany({ where: { attempt: { userId: account.id } } });
      await tx.userAttempt.deleteMany({ where: { userId: account.id } });
      await tx.practiceSession.deleteMany({ where: { userId: account.id } });
      await tx.userTopicProgress.deleteMany({ where: { userId: account.id } });
      await tx.dailyGoal.deleteMany({ where: { userId: account.id } });
      await tx.user.delete({ where: { id: account.id, email: account.email } });
    });
  }
  await prisma.$disconnect();
});
