import katex from 'katex';
import { topicLessons } from '../lib/i18n/lessons';

for (let i = 1; i <= 15; i++) {
  const t = topicLessons['t' + i];
  ['ru', 'kk', 'en'].forEach(loc => {
    const ex = (t as any)[loc].example;
    const lines = ex.split('\n');
    lines.forEach((line: string) => {
      try {
        const out = katex.renderToString(line, { throwOnError: false, displayMode: true });
        // check if katex emitted an error span
        const hasError = out.includes('katex-error');
        if (hasError) {
          console.log(`[HAS ERROR] t${i} [${loc}]: "${line}"`);
        } else {
          // OK
        }
      } catch (e: any) {
        console.log(`[EXCEPTION] t${i} [${loc}]: "${line}" -> ${e.message}`);
      }
    });
  });
}
console.log('Check finished.');
