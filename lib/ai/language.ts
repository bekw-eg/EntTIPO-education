import type { Locale } from '../i18n/types';

/** Reject clear Russian prose instead of displaying it in a Kazakh conversation. */
export function assertTutorLanguage(text: string, language?: Locale) {
  if (language !== 'kk') return;
  const prose = text.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, '');
  if (/(?<!\p{L})(?:это|чтобы|поскольку|поэтому|сначала|затем|далее|например|получаем|равен|равна|вычислите|вычисляем|найдите|решите|упростите|нужно|необходимо|ошибка|ответ|производная|условие|объяснение|примените|проверьте|подставьте|умножаем|умножьте|складываем|складывайте|сложите|разделите|используйте|замените|степень|степени|показатели|скобки|правило|выражение|значение|число|числа|подсказка|рекомендация|верно|неверно)(?!\p{L})/iu.test(prose)) {
    throw new Error('Tutor response language mismatch');
  }
}
