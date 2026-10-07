import messages from './ui-content.json';
import type { Locale } from './types';
import { translateContent } from './content';
import { preparationText } from './preparation';

const exact = new Map(messages.map(([ru, kk]) => [ru, kk]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = messages.filter(([ru]) => /\{\d+\}/.test(ru)).map(([ru, kk]) => ({
  pattern: new RegExp('^' + ru.split(/\{\d+\}/).map(escape).join('([\\s\\S]*?)') + '$'), kk,
}));
export function uiText(source: string, locale: Locale): string {
  if (locale !== 'kk') return source;
  const trimmed = source.trim();
  const translated = exact.get(trimmed) ?? translateContent(trimmed);
  if (translated) return source.replace(trimmed, translated);
  for (const { pattern, kk } of templates) {
    const match = source.match(pattern);
    if (match) return kk.replace(/\{(\d+)\}/g, (_, i) => uiText(match[Number(i) + 1], locale));
  }
  return source;
}

const errors: Record<string, string> = {
  'Diagnostic Kazakh translations are incomplete': 'Диагностика тапсырмаларының қазақша аудармасы толық емес. Кейінірек қайталап көріңіз.',
  'Invalid request payload': 'Сұраныс деректері дұрыс емес.',
  'Attempt not found': 'Шешу әрекеті табылмады.',
  'Attempt does not match the question': 'Шешу әрекеті тапсырмаға сәйкес келмейді.',
  'Attempt does not match the session': 'Шешу әрекеті жаттығуға сәйкес келмейді.',
  'Unknown action': 'Әрекет белгісіз.',
  'Submission ID has already been used for another answer': 'Жіберу идентификаторы басқа жауап үшін қолданылған.',
  'Submission ID already used for another answer': 'Жіберу идентификаторы басқа жауап үшін қолданылған.',
  'Submission result is not available': 'Жіберілген жауаптың нәтижесі қолжетімсіз.',
  'Use the diagnostic endpoint for this question': 'Бұл тапсырманы диагностика бөлімінде орындаңыз.',
  'Question does not match the session topic': 'Тапсырма жаттығу тақырыбына сәйкес келмейді.',
  'All questions in this session have already been answered': 'Бұл жаттығудың барлық тапсырмасына жауап берілген.',
  'Invalid attempt payload': 'Шешу әрекетінің деректері дұрыс емес.',
  'Internal server error': 'Серверде қате пайда болды. Қайталап көріңіз.',
  'sessionId is required': 'Жаттығуды таңдаңыз.',
  'Деморежим отключён': 'Демонұсқа өшірілген.',
  'Демопрофиль не настроен': 'Демонстрациялық профиль бапталмаған.',
  'Введите email и пароль': 'Email және құпиясөзді енгізіңіз.',
  'Ошибка сервера при входе': 'Кіру кезінде серверде қате пайда болды.',
  'Введите имя, корректный email и пароль от 4 до 128 символов': 'Атыңызды, дұрыс email және 4–128 таңбадан тұратын құпиясөзді енгізіңіз.',
  'Пользователь с таким email уже зарегистрирован': 'Бұл email бойынша қолданушы тіркелген.',
  'Ошибка сервера при регистрации': 'Тіркелу кезінде серверде қате пайда болды.',
  'Invalid diagnostic start': 'Диагностиканы бастау деректері дұрыс емес.',
  'Could not start diagnostic': 'Диагностиканы бастау мүмкін болмады.',
  'Invalid diagnostic answer': 'Диагностика жауабының пішімі дұрыс емес.',
  'Could not save answer': 'Жауапты сақтау мүмкін болмады.',
  'Invalid diagnostic state': 'Диагностика күйі дұрыс емес.',
  'Could not load diagnostic': 'Диагностиканы жүктеу мүмкін болмады.',
  'Diagnostic changed; reload the saved state': 'Диагностика өзгерді. Сақталған күйді қайта жүктеңіз.',
  'Answers must belong to the current question': 'Жауаптар ағымдағы тапсырмаға тиесілі болуы керек.',
  'Unknown exam profile': 'Емтихан профилі белгісіз.',
  'Не удалось проверить фактический банк задач': 'Нақты тапсырмалар қорын тексеру мүмкін болмады.',
  'Invalid plan request': 'Жоспар сұранысы дұрыс емес.',
  'Could not load learning plan': 'Оқу жоспарын жүктеу мүмкін болмады.',
  'Mistake not found': 'Қате жазбасы табылмады.',
  'Could not start mistake check': 'Қатені тексеруді бастау мүмкін болмады.',
  'Only a viewing flag may be changed manually': 'Қолмен тек қаралған белгісін өзгертуге болады.',
  'Нет доступных заданий для этой тренировки': 'Бұл жаттығу үшін қолжетімді тапсырмалар жоқ.',
  'Invalid session settings': 'Жаттығу баптаулары дұрыс емес.',
  'Question ID is required': 'Тапсырманы таңдаңыз.',
  'Could not record hint usage': 'Нұсқауды пайдалануды сақтау мүмкін болмады.',
  'Invalid question index': 'Тапсырманың орны дұрыс емес.',
  'No question found at this index': 'Бұл орында тапсырма табылмады.',
  'Invalid practice state': 'Жаттығу күйі дұрыс емес.',
  'Session changed; reload its latest state': 'Жаттығу өзгерді. Соңғы күйін қайта жүктеңіз.',
  'No question at this position': 'Бұл орында тапсырма жоқ.',
  'Question state changed; reload its latest state': 'Тапсырма күйі өзгерді. Соңғы күйін қайта жүктеңіз.',
  'Check the solution before continuing': 'Жалғастырмас бұрын шешімді тексеріңіз.',
  'Could not save practice state': 'Жаттығу күйін сақтау мүмкін болмады.',
  'Could not load skills': 'Дағдыларды жүктеу мүмкін болмады.',
  'Topic not found': 'Тақырып табылмады.',
  'User not found': 'Қолданушы табылмады.',
  'Account not found': 'Аккаунт табылмады.',
  'Invalid time zone': 'Уақыт белдеуі дұрыс емес.',
  'Could not save time zone': 'Уақыт белдеуін сақтау мүмкін болмады.',
  'Missing parameters': 'Қажетті деректер көрсетілмеген.',
  'Skill not found': 'Дағды табылмады.',
  'Question does not test the requested skill': 'Тапсырма таңдалған дағдыны тексермейді.',
  'Started plans are preserved; new diagnostic results apply tomorrow': 'Басталған жоспарлар сақталады; жаңа диагностика нәтижелері ертең қолданылады.',
  "No new assessment is available, or today's plan has already started": 'Жаңа бағалау жоқ немесе бүгінгі жоспар басталып қойған.',
  'Plan action not found': 'Жоспар әрекеті табылмады.',
  'Only rule viewing can be marked manually': 'Қолмен тек ереженің қаралғанын белгілеуге болады.',
  'Completed source diagnostic not found': 'Аяқталған бастапқы диагностика табылмады.',
  'Question is not part of this diagnostic': 'Тапсырма бұл диагностикаға кірмейді.',
  'Provide one answer for every step': 'Әр қадамға бір жауаптан енгізіңіз.',
  'Question already answered': 'Тапсырмаға жауап берілген.',
  'Разбор предыдущего экзамена доступен после завершения текущего': 'Алдыңғы емтиханның талдауы ағымдағы емтихан аяқталған соң қолжетімді болады.',
  'Этот идентификатор запуска уже использован с другими настройками': 'Бұл іске қосу идентификаторы басқа баптаулармен қолданылған.',
  'Идентификатор сохранения уже использован': 'Сақтау идентификаторы қолданылған.',
  'Review is not due yet': 'Қайталау уақыты әлі келген жоқ.',
  'Для доступа к личным данным необходимо войти в аккаунт': 'Жеке деректерге қол жеткізу үшін аккаунтқа кіріңіз.',
  'Во время экзамена подсказки, AI-помощь и промежуточная проверка недоступны. Завершите экзамен или откройте его после истечения времени.': 'Емтихан кезінде нұсқаулар, AI көмегі және аралық тексеру қолжетімсіз. Емтиханды аяқтаңыз немесе уақыт өткеннен кейін ашыңыз.',
  'Не удалось обработать запрос. Повторите его: завершение экзамена безопасно повторять.': 'Сұранысты өңдеу мүмкін болмады. Қайталаңыз: емтиханды аяқтау сұранысын қайталау нәтижені өзгертпейді.',
  'Unauthorized': 'Жалғастыру үшін аккаунтқа кіріңіз.',
  'Authentication required': 'Жалғастыру үшін аккаунтқа кіріңіз.',
  'Invalid JSON': 'Сұраныс пішімі дұрыс емес. Қайталап көріңіз.',
  'Session not found': 'Жаттығу табылмады.',
  'Question not found': 'Тапсырма табылмады.',
  'Question is not part of this session': 'Тапсырма бұл жаттығуға кірмейді.',
  'Session is already completed': 'Жаттығу аяқталған.',
  'Diagnostic not found': 'Диагностика табылмады.',
  'Diagnostic bank is unavailable; apply the skill data upgrade': 'Диагностика тапсырмалары әзірге қолжетімсіз.',
  'Provide exactly one answer for every step of this question': 'Әр қадамға бір жауаптан енгізіңіз.',
  'Экзамен не найден': 'Емтихан табылмады.',
  'Некорректные параметры экзамена': 'Емтихан баптаулары дұрыс емес.',
  'Неизвестный профиль или версия': 'Профиль немесе нұсқа белгісіз.',
  'Состояние изменено в другой вкладке. Загрузите сохранённую версию.': 'Күй басқа қойындыда өзгерді. Сақталған нұсқаны жүктеңіз.',
  'Ответ или позиция не принадлежат варианту': 'Жауап немесе орын бұл нұсқаға тиесілі емес.',
  'AI help is disabled for entrance diagnostic tasks': 'Кіріс диагностикасында AI көмегі қолжетімсіз.',
  'Неверный email или пароль': 'Email немесе құпиясөз дұрыс емес.',
};

/** Raw service details stay in server logs, never become untranslated user errors. */
export function errorText(source: string | undefined, locale: Locale): string {
  if (source && preparationText[locale].errors[source]) return preparationText[locale].errors[source];
  if (source && Object.values(preparationText[locale].errors).includes(source)) return source;
  if (locale !== 'kk') return source || 'Не удалось выполнить действие. Попробуйте ещё раз.';
  if (source && errors[source]) return errors[source];
  if (source) { const translated = uiText(source, locale); if (translated !== source || /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(source)) return translated; }
  return 'Әрекетті орындау мүмкін болмады. Байланысты тексеріп, қайталап көріңіз.';
}

export function browserLocale(): Locale {
  try { const saved = localStorage.getItem('ent_tipo_locale'); return saved === 'kk' || saved === 'en' ? saved : 'ru'; } catch { return 'ru'; }
}
