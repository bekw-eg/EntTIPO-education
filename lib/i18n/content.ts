import generated from './generator-content.json';
import legacy from './legacy-content.json';
import { SKILLS, DIAGNOSTIC_EXERCISES, PRACTICE_EXERCISES } from '../skillCatalog';
import { DAILY_EXERCISES } from '../dailyLearningBank';
import { examExercisesKk, examPointsKk } from './exam-content';
import { TIPO_MATH } from '../exam/profile';
import type { Locale } from './types';

const authored = new Map([...DIAGNOSTIC_EXERCISES, ...PRACTICE_EXERCISES, ...DAILY_EXERCISES].map(q => [q.id, q]));
const exact = new Map<string, string>([...legacy, ...generated].filter(([ru]) => !/\{\d+\}/.test(ru)).map(([ru, kk]) => [ru, kk]));
for (const skill of SKILLS) exact.set(skill.ruleRu, skill.ruleKk);
for (const point of TIPO_MATH.points) exact.set(point.title, examPointsKk[point.code].title);
for (const q of authored.values()) {
  exact.set(q.title, q.titleKk); exact.set(q.questionText, q.questionTextKk); exact.set(q.explanation, q.explanationKk);
  q.steps.forEach(s => exact.set(s.prompt, s.promptKk));
}
exact.set('a^m · a^n = a^(m+n); a^m / a^n = a^(m−n), a ≠ 0; (a^m)^n = a^(mn). Для дробных показателей здесь a > 0. Показатели складывают при умножении, но перемножают при возведении степени в степень.',
  'a^m · a^n = a^(m+n); a^m / a^n = a^(m−n), a ≠ 0; (a^m)^n = a^(mn). Мұнда бөлшек көрсеткіштер үшін a > 0. Көбейткенде көрсеткіштерді қосамыз, дәрежені дәрежеге шығарғанда көбейтеміз.');
exact.set('Сложи показатели.', 'Көрсеткіштерді қос.');
exact.set('Минус меняет каждый знак.', 'Минус әрбір таңбаны өзгертеді.');
exact.set('Выберите один правильный ответ', 'Бір дұрыс жауапты таңдаңыз');
exact.set('Поверхности тел вращения', 'Айналу денелерінің беттері');
exact.set('Объёмы тел', 'Денелердің көлемдері');
exact.set('Математика', 'Математика');
exact.set('Геометрия', 'Геометрия');
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = generated.filter(([ru]) => /\{\d+\}/.test(ru)).map(([ru, kk]) => ({
  pattern: new RegExp('^' + ru.split(/\{\d+\}/).map(escape).join('([\\s\\S]*?)') + '$'), kk,
}));

/** Only whole authored sentences/templates are translated. Formula payloads are opaque. */
export function translateContent(source: string | null | undefined): string | undefined {
  if (source == null) return undefined;
  const known = exact.get(source);
  if (known) return known;
  for (const { pattern, kk } of templates) {
    const match = source.match(pattern);
    if (match) return kk.replace(/\{(\d+)\}/g, (_, index) => match[Number(index) + 1]);
  }
  if (isLanguageNeutral(source)) return source;
  return undefined;
}

/** Units, proper mathematical names and technical subscripts are not untranslated prose. */
export function isLanguageNeutral(source: string) {
  const text = source.replace(/\[GEOMETRY:[\s\S]*\]/g, '').replace(/S_осн|S_бок|Sосн|Sбок|Sполн|асимпт/g, '')
    .replace(/(?<!\p{L})(?:Пифагор|Эйлер|Гаусс|Ньютон|Лейбниц|Коши|Лагранж|Виет)(?!\p{L})/gu, '')
    .replace(/(?<!\p{L})(?:см|мм|км|м|с|кг)(?!\p{L})/gu, '');
  if (/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(text)) return false;
  if (/^[\w.:/-]+$/.test(text.trim())) return true; // Technical key or a single proper name.
  const words = text.match(/[A-Za-z_][A-Za-z_0-9]*/g) ?? [];
  return words.every(word => word.length === 1 || /[_0-9]/.test(word) || /^[abcdefghijklmnoprstuvxyz]{2,3}$/i.test(word) ||
    ['sqrt', 'sin', 'cos', 'tan', 'cot', 'tg', 'ctg', 'arcsin', 'arccos', 'arctan', 'ln', 'log', 'exp', 'pi', 'dx', 'dy', 'frac', 'cdot', 'quad'].includes(word));
}

export function contentText(ru: string | null | undefined, kk: string | null | undefined, locale: Locale): string {
  if (locale !== 'kk') return ru ?? '';
  return kk?.trim() || translateContent(ru) || 'Бұл материалдың қазақша аудармасы әзірге қолжетімсіз.';
}

export interface TranslatableQuestion {
  id?: string; title: string; questionText: string; explanation?: string; titleKk?: string | null;
  questionTextKk?: string | null; explanationKk?: string | null; localizationSource?: string | null;
  steps: { order?: number; prompt: string; promptKk?: string | null; hint?: string | null; hintKk?: string | null;
    options?: { order?: number; text: string; textKk?: string | null }[] }[];
}

export function hasContentTranslation(source: string | null | undefined, value: string | null | undefined): boolean {
  return !!value?.trim() && (value !== source || isLanguageNeutral(value) || translateContent(value) === value);
}

/** Exact source stamp invalidates translations when any authored text or option order changes. */
export function questionLocalizationSource(q: TranslatableQuestion) {
  return JSON.stringify([q.title, q.questionText, q.explanation ?? '',
    q.steps.map(s => [s.order, s.prompt, s.hint ?? null, (s.options ?? []).map(o => [o.order, o.text])])]);
}

export function questionTranslations(q: TranslatableQuestion) {
  const known = q.id ? authored.get(q.id) : undefined;
  const exam = q.id ? examExercisesKk[q.id.replace(/^exam_v1_/, '')] : undefined;
  return {
    titleKk: known?.titleKk ?? q.titleKk ?? translateContent(q.title),
    questionTextKk: known?.questionTextKk ?? exam?.text ?? q.questionTextKk ?? translateContent(q.questionText),
    explanationKk: known?.explanationKk ?? exam?.explanation ?? q.explanationKk ?? translateContent(q.explanation),
    steps: q.steps.map((s, i) => ({ promptKk: known?.steps[i]?.promptKk ?? s.promptKk ?? translateContent(s.prompt),
      hintKk: s.hint ? s.hintKk ?? translateContent(s.hint) : null,
      options: (s.options ?? []).map((o, j) => ({ textKk: exam?.options?.[j] ?? o.textKk ?? translateContent(o.text) })),
    })),
  };
}

export function missingQuestionTranslations(q: TranslatableQuestion, requireStamp = true): string[] {
  const missing: string[] = [];
  const check = (field: string, value: string | null | undefined, source?: string | null) => {
    if (!value?.trim()) missing.push(field);
    else if (!hasContentTranslation(source, value)) missing.push(`${field}: copied source`);
  };
  check('titleKk', q.titleKk, q.title); check('questionTextKk', q.questionTextKk, q.questionText); check('explanationKk', q.explanationKk, q.explanation);
  q.steps.forEach((s, i) => {
    check(`steps.${i}.promptKk`, s.promptKk, s.prompt);
    if (s.hint) check(`steps.${i}.hintKk`, s.hintKk, s.hint);
    s.options?.forEach((o, j) => check(`steps.${i}.options.${j}.textKk`, o.textKk, o.text));
  });
  if (requireStamp && q.localizationSource !== questionLocalizationSource(q)) missing.push('localizationSource');
  return missing;
}

export function answerText(answer: string, step: { options?: { id?: string; text: string; textKk?: string | null }[] } | undefined, locale: Locale) {
  const option = step?.options?.find(o => o.id === answer || o.text === answer);
  return option ? contentText(option.text, option.textKk, locale) : locale === 'kk' ? translateContent(answer) ?? answer : answer;
}

export function withKazakhContent<T extends TranslatableQuestion>(q: T) {
  const translated = questionTranslations(q);
  return { ...q, ...translated, localizationSource: questionLocalizationSource(q),
    steps: q.steps.map((s, i) => ({ ...s, ...translated.steps[i],
      options: (s.options ?? []).map((o, j) => ({ ...o, ...translated.steps[i].options[j] })),
    })) };
}
