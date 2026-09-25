import { topicLessons } from '../lib/i18n/lessons';

for (let i = 1; i <= 15; i++) {
  const t = topicLessons['t' + i];
  console.log(`\n=== TOPIC t${i} ===`);
  console.log('[RU]:', JSON.stringify(t.ru.example));
  console.log('[KK]:', JSON.stringify(t.kk.example));
  console.log('[EN]:', JSON.stringify(t.en.example));
}
