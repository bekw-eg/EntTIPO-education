import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { seedKazakhContent } from '../prisma/kazakhSeed';
import { missingQuestionTranslations, answerText } from '../lib/i18n/content';
import { TIPO_MATH } from '../lib/exam/profile';
import { questionFingerprint } from '../lib/exam/fingerprint';
import { assertTutorLanguage } from '../lib/ai/language';
import type { PaperQuestion } from '../lib/exam/mode';
import { topicLessons } from '../lib/i18n/lessons';

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
async function practice(cookie: string, questionId: string, skillId: string, language = 'kk') {
  const r = await api('/api/sessions', cookie, 'POST', { mode: 'mixed', totalCount: 1, questionId, skillId }, language);
  assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.id as string;
}
async function submit(cookie: string, sessionId: string, questionId: string, correct: boolean, language = 'kk') {
  const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { steps: { include: { options: true } } } });
  const r = await api('/api/attempts', cookie, 'POST', { submissionId: randomUUID(), sessionId, questionId,
    stepAnswers: q.steps.map(s => ({ stepId: s.id, answer: correct ? s.type === 'multiple_choice'
      ? s.options.find(o => o.isCorrect)!.text : s.expectedAnswer : s.type === 'multiple_choice'
      ? s.options.find(o => !o.isCorrect)!.text : '999999' })) }, language);
  assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data;
}
function privateQuestion(question: any) {
  for (const field of ['correctAnswer', 'explanation', 'explanationKk', 'localizationSource']) assert.ok(!(field in question), field);
  for (const step of question.steps) {
    for (const field of ['hint', 'hintKk', 'expectedAnswer']) assert.ok(!(field in step), field);
    step.options.forEach((o: any) => assert.ok(!('isCorrect' in o)));
  }
}
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
  assert.match((await api('/api/sessions')).data.error, /кіріңіз/);
  const a = await register('KK'), b = await register('RU'), c = await register('missing');
  const initial = await bank();
  assert.ok(initial.length > 0);
  initial.forEach(q => assert.deepEqual(missingQuestionTranslations(q), [], q.id));
  const lesson = (await api('/api/topics/t1', a.cookie)).data.lesson;
  assert.ok(lesson.contentKk.whatIsIt && lesson.contentKk.commonErrors && lesson.contentKk.example);
  assert.equal(lesson.contentKk.formulaLatex, topicLessons.t1.ru.formulaLatex);

  // A textual choice stays canonical in both languages, including persisted drafts and hint penalties.
  const choice = initial.find(q => q.id === 'exam_v1_rational_range')!;
  const id = await practice(a.cookie, choice.id, choice.skills[0].skillId);
  const path = `/api/sessions/${id}`;
  let state = (await api(path, a.cookie)).data;
  privateQuestion(state.question);
  const draft = { [choice.steps[0].id]: choice.steps[0].options.find(o => !o.isCorrect)!.text };
  const saved = await api(`${path}/state`, a.cookie, 'PATCH', { action: 'save', currentIndex: 0, revision: state.revision, answers: draft }, 'ru');
  assert.equal(saved.status, 200);
  const hint = await api(`${path}/hint`, a.cookie, 'POST', { questionId: choice.id });
  assert.equal(hint.status, 200);
  assert.ok(Object.values(hint.data.hintsKk).every(value => typeof value === 'string' && value.length > 0));
  state = (await api(path, a.cookie, 'GET', undefined, 'ru')).data;
  const switched = (await api(path, a.cookie)).data;
  for (const field of ['id', 'questionIds', 'currentIndex', 'draftAnswers', 'revision', 'result']) assert.deepEqual(switched[field], state[field], field);
  assert.equal(switched.question.usedHint, true);
  assert.equal(answerText(draft[choice.steps[0].id], switched.question.steps[0], 'kk'), choice.steps[0].options.find(o => !o.isCorrect)!.textKk);
  const wrongKk = await submit(a.cookie, id, choice.id, false);
  assert.equal(wrongKk.isCorrect, false); assert.ok(wrongKk.explanationKk);
  const russianSession = await practice(b.cookie, choice.id, choice.skills[0].skillId, 'ru');
  await api(`/api/sessions/${russianSession}/hint`, b.cookie, 'POST', { questionId: choice.id }, 'ru');
  const wrongRu = await submit(b.cookie, russianSession, choice.id, false, 'ru');
  for (const field of ['isCorrect', 'isPartial', 'usedHint', 'score']) assert.equal(wrongKk[field], wrongRu[field], field);
  state = (await api(path, a.cookie, 'GET', undefined, 'ru')).data;
  assert.deepEqual((await api(path, a.cookie)).data.result, state.result);
  assert.equal(state.result.attemptId, wrongKk.attemptId);
  const retry = await api(`${path}/state`, a.cookie, 'PATCH', { action: 'retry', revision: state.revision });
  assert.equal(retry.status, 200);
  const correct = await submit(a.cookie, id, choice.id, true);
  assert.equal(correct.isCorrect, true); assert.equal(correct.usedHint, true);
  const ruState = (await api(`/api/sessions/${russianSession}`, b.cookie, 'GET', undefined, 'ru')).data;
  await api(`/api/sessions/${russianSession}/state`, b.cookie, 'PATCH', { action: 'retry', revision: ruState.revision }, 'ru');
  assert.equal((await submit(b.cookie, russianSession, choice.id, true, 'ru')).score, correct.score);
  const mistakes = (await api('/api/mistakes', a.cookie)).data.mistakes;
  assert.ok(mistakes.some((m: any) => m.question.questionTextKk && m.question.explanationKk));

  // Diagnostic keys and assistance remain private; result, feedback and next-task conditions are bilingual.
  const diagnostic = await api('/api/diagnostics', a.cookie, 'POST', {});
  assert.equal(diagnostic.status, 200); assert.equal(diagnostic.data.totalCount, 9);
  for (let i = 0; i < 9; i++) {
    const d = (await api(`/api/diagnostics/${diagnostic.data.id}`, a.cookie)).data;
    privateQuestion(d.question); assert.ok(d.question.questionTextKk);
    const q = initial.find(q => q.id === d.question.id)!;
    const r = await api(`/api/diagnostics/${d.id}/answers`, a.cookie, 'POST', { submissionId: randomUUID(),
      questionId: q.id, revision: d.revision, stepAnswers: q.steps.map(s => ({ stepId: s.id,
        answer: q.id.startsWith('diag_power') ? '999999' : s.type === 'multiple_choice' ? s.options.find(o => o.isCorrect)!.id : s.expectedAnswer })) });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const diagnosticResult = (await api(`/api/diagnostics/${diagnostic.data.id}`, a.cookie)).data.result;
  assert.equal(diagnosticResult.totalCount, 9);
  for (const skill of diagnosticResult.skills) {
    assert.ok(skill.nameKk && skill.ruleKk && skill.explanationKk);
    skill.evidence.forEach((e: any) => { assert.ok(e.questionTextKk && e.explanationKk); if (!e.isCorrect) assert.ok(e.feedback.kk); });
    if (skill.recommendation) assert.ok(skill.recommendation.questionTextKk);
  }
  const plan = (await api('/api/learning-plan', a.cookie)).data;
  assert.ok(plan.actions.some((action: any) => action.kind === 'rule'));
  assert.ok(plan.actions.some((action: any) => action.kind === 'practice'));
  for (const action of plan.actions) if (action.skill) assert.ok(action.skill.nameKk && action.skill.ruleKk && action.skill.explanationKk);
  assert.deepEqual((await api('/api/learning-plan', a.cookie, 'GET', undefined, 'ru')).data.actions, plan.actions);
  const work = plan.actions.find((action: any) => action.kind === 'practice');
  const started = await api('/api/learning-plan', a.cookie, 'POST', { action: 'start', actionId: work.id });
  assert.equal(started.status, 200);
  const workId = started.data.href.split('/').at(-1);
  const workState = (await api(`/api/sessions/${workId}`, a.cookie)).data;
  for (const questionId of workState.questionIds) {
    assert.ok(initial.find(q => q.id === questionId)!.questionTextKk);
    await submit(a.cookie, workId, questionId, true);
  }
  assert.ok((await api('/api/learning-plan', a.cookie)).data.actions.find((action: any) => action.id === work.id).completedAt);

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

  // Missing translation on the only point-16 exercise refuses a Kazakh paper; it is still eligible in RU.
  damaged = await prisma.question.findUniqueOrThrow({ where: { id: 'exam_v1_ode_repeated_initial' }, select: { id: true, questionTextKk: true } });
  await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: null } });
  const refused = await api('/api/exams', c.cookie, 'POST', { ...settings, requestId: randomUUID() });
  assert.equal(refused.status, 422); assert.match(refused.data.error, /аударылған/); assert.match(refused.data.error, /16/);
  const kkCoverage = (await api('/api/exam-coverage?language=kk', c.cookie)).data;
  assert.equal(kkCoverage.questions.find((q: any) => q.id === damaged!.id).eligible, false);
  const ruCoverage = (await api('/api/exam-coverage?language=ru', c.cookie, 'GET', undefined, 'ru')).data;
  assert.equal(ruCoverage.questions.find((q: any) => q.id === damaged!.id).eligible, true);
  await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: damaged.questionTextKk } }); damaged = null;
  const invalid = await api('/api/sessions', c.cookie, 'POST', { mode: 'bogus' });
  assert.equal(invalid.status, 400); assert.match(invalid.data.error, /Жаттығу/);
  // Validation paths need no provider credentials and must already answer in the selected language.
  const ai = await api('/api/ai/tutor', c.cookie, 'POST', { action: 'unknown', language: 'kk' });
  assert.equal(ai.status, 400); assert.match(ai.data.error, /Сұраныс/); assertTutorLanguage(ai.data.error, 'kk');
  console.log('PASS: Kazakh diagnostic → theory → practice → error → personal plan → 20-question exam → 12/20 result; RU/KK grading parity and saved state, hints, formulas, migration/seeding replay, untranslated-exam refusal and API language.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (damaged) await prisma.question.update({ where: { id: damaged.id }, data: { questionTextKk: damaged.questionTextKk } });
  for (const account of accounts) if (await prisma.user.findFirst({ where: { id: account.id, email: account.email } })) {
    await prisma.$transaction(async tx => {
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
