import assert from 'node:assert/strict';
import katex from 'katex';
import { generateQuestionsBatch, generateQuestionForSkill } from '../lib/questionGenerator';
import { contentText, answerText, missingQuestionTranslations, withKazakhContent, isLanguageNeutral, hasContentTranslation } from '../lib/i18n/content';
import { topicLessons } from '../lib/i18n/lessons';
import { EXAM_EXERCISES, exerciseQuestion } from '../lib/exam/bank';
import { questionFingerprint } from '../lib/exam/fingerprint';
import { auditCoverage } from '../lib/exam/coverage';
import { TIPO_MATH } from '../lib/exam/profile';
import { gradeExamQuestion, type PaperQuestion } from '../lib/exam/mode';
import { assertTutorLanguage } from '../lib/ai/language';
import { errorText, uiText } from '../lib/i18n/messages';
import { requestLocale, localizedJson } from '../lib/i18n/http';
import { getBaseSystemPrompt } from '../lib/ai/prompts';

const bank = EXAM_EXERCISES.map(q => withKazakhContent(exerciseQuestion(q)));
for (const q of [...generateQuestionsBatch(40), ...bank, ...['chain_rule', 'bracket_signs'].map(id => generateQuestionForSkill(id)!)]) {
  assert.deepEqual(missingQuestionTranslations(q), [], q.title);
  if (q.latex) assert.ok(katex.renderToString(q.latex, { throwOnError: true }));
  for (const step of q.steps) {
    const choice = step.options.find(o => o.isCorrect);
    if (choice) {
      assert.equal(answerText(choice.text, step, 'kk'), choice.textKk);
      assert.equal(choice.text, step.expectedAnswer);
    }
  }
  const geometry = q.questionText.match(/\[GEOMETRY:[\s\S]*\]/)?.[0];
  if (geometry) assert.equal(q.questionTextKk!.match(/\[GEOMETRY:[\s\S]*\]/)?.[0], geometry);
}
for (const lesson of Object.values(topicLessons)) {
  for (const locale of ['ru', 'kk'] as const) {
    katex.renderToString(lesson[locale].formulaLatex, { throwOnError: true });
    for (const math of lesson[locale].example.matchAll(/\$([^$]+)\$/g)) katex.renderToString(math[1], { throwOnError: true });
  }
}
assert.match(contentText('Untranslated Russian task', null, 'kk'), /қазақша/); // English prose needs an authored translation too.
assert.equal(uiText(' Ваш ответ: ', 'kk'), ' Сіздің жауабыңыз: ');
assert.equal(uiText('Вариант 3: x²', 'kk'), '3 нұсқа: x²');
assert.equal(contentText('Жауап', 'Жауап', 'kk'), 'Жауап');
const q = bank[0];
assert.notEqual(q.title, q.titleKk);
assert.equal(questionFingerprint(q), questionFingerprint(exerciseQuestion(EXAM_EXERCISES[0])));
assert.ok(missingQuestionTranslations({ ...q, explanationKk: '' }).includes('explanationKk'));
assert.ok(missingQuestionTranslations({ ...q, questionTextKk: q.questionText }).some(f => f.includes('copied source')));
assert.ok(missingQuestionTranslations({ ...q, questionText: q.questionText + ' changed' }).includes('localizationSource'));
const good = auditCoverage(TIPO_MATH, bank, undefined, 'kk');
const damaged = bank.map(q => ({ ...q, questionTextKk: null }));
assert.ok(good.questions.every(q => q.eligible));
assert.equal(auditCoverage(TIPO_MATH, damaged, undefined, 'kk').totals.eligible, 0);
assert.ok(auditCoverage(TIPO_MATH, damaged).totals.eligible > 0);
for (const q of bank) {
  const ru: PaperQuestion = { ...q, contentHash: questionFingerprint(q), pointCode: '01', band: 'B', family: 'test',
    topicName: '', skillIds: [], skillNames: [], options: q.steps[0].options.map(o => o.text),
    correctIndex: q.steps[0].options.findIndex(o => o.isCorrect), previouslyExposed: false };
  const kk = { ...ru, title: q.titleKk!, questionText: q.questionTextKk!, explanation: q.explanationKk!, options: q.steps[0].options.map(o => o.textKk!) };
  for (const answer of [undefined, 0, 1, 2, 3]) {
    const a = gradeExamQuestion(TIPO_MATH, ru, answer), b = gradeExamQuestion(TIPO_MATH, kk, answer);
    assert.deepEqual([a.isCorrect, a.points, a.skipped, a.correctIndex], [b.isCorrect, b.points, b.skipped, b.correctIndex]);
  }
}
assert.throws(() => assertTutorLanguage('Сначала найдите производную.', 'kk'), /language mismatch/);
assert.throws(() => assertTutorLanguage('Сложите числа в скобках.', 'kk'), /language mismatch/);
assert.doesNotThrow(() => assertTutorLanguage('Алдымен туындыны табыңыз: $f′(x)=2x$.', 'kk'));
assert.doesNotThrow(() => assertTutorLanguage('Коши: $y′=2xy$.', 'kk'));
assert.ok(isLanguageNeutral('Коши'));
assert.ok(hasContentTranslation('Коши', 'Коши'));
assert.ok(hasContentTranslation('Математика', 'Математика'));
assert.ok(!hasContentTranslation('Правило степени', 'Правило степени'));
assert.ok(isLanguageNeutral('S_бок = 2*pi*r*h'));
assert.ok(!isLanguageNeutral('Теорема Пифагора'));
assert.match(getBaseSystemPrompt('kk', 40), /ҚАЗАҚ ТІЛІНДЕ/);
const request = new Request('http://localhost', { headers: { cookie: 'ent_tipo_locale=kk' } });
assert.equal(requestLocale(request), 'kk');
assert.match(errorText('Session not found', 'kk'), /табылмады/);
assert.match(errorText('Unknown vendor stack trace', 'kk'), /Әрекетті/);
assert.equal(errorText('Session not found', 'ru'), 'Session not found');
localizedJson(request, { error: 'Session not found' }, { status: 404 }).json().then(data => assert.equal(data.error, 'Жаттығу табылмады.'));
console.log('Kazakh unit checks passed: 400 generated tasks, authored exam bank, opaque formulas/geometry, grading parity, missing/stale/copy guards, UI/API/AI language.');
