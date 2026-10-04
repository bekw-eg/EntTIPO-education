/**
 * Prompts and context builders for ENT TiPO AI Tutor.
 */

export interface QuestionContext {
  id?: string;
  title: string;
  questionText: string;
  latex?: string | null;
  difficulty: number;
  topicName: string;
  subtopicName?: string | null;
  correctAnswer?: string;
  steps?: Array<{
    order: number;
    prompt: string;
    expectedAnswer: string;
    hint?: string | null;
  }>;
}

export interface UserContext {
  language: "ru" | "kk" | "en";
  masteryScore: number;
  currentLevel: number;
  userAnswer?: string;
  stepAnswers?: Record<string, string>;
  previousWeakSkills?: string[];
  previousErrorTypes?: string[];
}

/**
 * Returns the base system prompt for the AI Tutor.
 */
export function getBaseSystemPrompt(language: "ru" | "kk" | "en", masteryScore: number): string {
  const langInstructions = {
    ru: "Отвечай строго на РУССКОМ языке. Будь дружелюбным, вежливым и ободряющим наставником.",
    kk: "Жауапты қатаң түрде ҚАЗАҚ ТІЛІНДЕ бер. ҰБТ ТжКБ (ЕНТ ТиПО) емтиханына дайындалып жатқан оқушыға мейірімді, жігерлендіруші ұстаз ретінде сөйле.",
    en: "Respond strictly in ENGLISH. Be a friendly, encouraging, and supportive tutor for technical college entrance exams.",
  };

  let masteryInstruction = "";
  if (masteryScore < 40) {
    masteryInstruction =
      "Уровень ученика в этой теме начальный (<40%). Объясняй предельно просто, по шагам, избегай сложной терминологии, приводи наглядные жизненные аналогии.";
  } else if (masteryScore < 70) {
    masteryInstruction =
      "Уровень ученика средний (40–70%). Базовые понятия известны, давай точные подсказки и направляй мыслительный процесс.";
  } else {
    masteryInstruction =
      "Уровень ученика продвинутый (>70%). Будь краток, помогай быстро выявить неочевидные нюансы или арифметические описки, стимулируй самостоятельность.";
  }

  return `Ты — персональный AI-преподаватель математики для платформы подготовки к ЕНТ ТиПО (Казахстан).

Твоя миссия — научить студента думать и понимать математику самостоятельно, а НЕ просто сообщать готовые ответы.

ОСНОВНЫЕ ПРАВИЛА:
1. ${langInstructions[language]}
2. ${masteryInstruction}
3. НЕ СООБЩАЙ финальный ответ задачи сразу, если ученик ещё решает её. Помогай наводящими вопросами и подсказками.
4. Все математические выражения пиши в формате LaTeX:
   - Внутри строк используй \\( ... \\) или $...$
   - Для отдельных формул используй \\[ ... \\] или $$...$$
5. Объясняй не просто механическую формулу, а логику: ПОЧЕМУ она здесь работает и КАК распознать такую задачу на экзамене.
6. Структурируй ответы: делай абзацы короткими, используй маркеры, выделяй ключевые шаги. Не выдавай огромные сплошные стены текста.
7. Не уходи в посторонние темы, держи фокус на программе математики ЕНТ ТиПО.`;
}

/**
 * Prompt for hints (Level 1, 2, or 3).
 */
export function buildHintPrompt(
  question: QuestionContext,
  user: UserContext,
  level: number
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  let levelInstruction = "";
  if (level === 1) {
    levelInstruction =
      "LEVEL 1 (Лёгкая подсказка): Напомни основное математическое правило, формулу или свойство, которое требуется для решения, НЕ подсказывая конкретные числа и шаги решения этой задачи.";
  } else if (level === 2) {
    levelInstruction =
      "LEVEL 2 (Направление решения): Свяжи правило с этой конкретной задачей. Покажи, какой первый или промежуточный шаг нужно сделать, но не вычисляй финальный результат.";
  } else {
    levelInstruction =
      "LEVEL 3 (Пошаговый разбор): Покажи последовательный план решения шаг за шагом с краткими пояснениями каждого действия.";
  }

  const userPrompt = `Задача: "${question.title}"
Условие: ${question.questionText}
${question.latex ? `Формула/выражение: ${question.latex}` : ""}
Тема: ${question.topicName}${question.subtopicName ? ` / ${question.subtopicName}` : ""}
Сложность: ${question.difficulty} из 5
${user.userAnswer ? `Текущий ответ пользователя: ${user.userAnswer}` : ""}

Запрос: Предоставь подсказку уровня ${level}.
Требование к подсказке: ${levelInstruction}`;

  return { system, user: userPrompt };
}

/**
 * Prompt for explaining condition simply.
 */
export function buildExplainConditionPrompt(
  question: QuestionContext,
  user: UserContext
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  const userPrompt = `Задача: "${question.title}"
Условие: ${question.questionText}
${question.latex ? `Формула/выражение: ${question.latex}` : ""}
Тема: ${question.topicName}

Запрос: Объясни условие этой задачи максимально простыми словами:
1. Что нам ДАНО?
2. Что именно от нас ТРЕБУЕТСЯ найти?
3. Какой физический или геометрический/алгебраический смысл у этого условия?
(Не давай готовый финальный ответ, просто сделай формулировку понятной).`;

  return { system, user: userPrompt };
}

/**
 * Prompt for explaining why a formula is used.
 */
export function buildWhyFormulaPrompt(
  question: QuestionContext,
  user: UserContext
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  const userPrompt = `Задача: "${question.title}"
Условие: ${question.questionText}
${question.latex ? `Формула/выражение: ${question.latex}` : ""}
Тема: ${question.topicName}

Запрос: Объясни:
1. Какая ключевая формула или теорема лежит в основе этой задачи?
2. ПОЧЕМУ именно она здесь применяется (какие признаки в условии указывают на неё)?
3. Какая самая частая ошибка бывает при её применении?`;

  return { system, user: userPrompt };
}

/**
 * Prompt for checking user steps / reasoning.
 */
export function buildCheckStepsPrompt(
  question: QuestionContext,
  user: UserContext,
  userNotes?: string
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  const stepsInfo = question.steps
    ? question.steps
        .map(
          (s) =>
            `Шаг ${s.order}: ${s.prompt} (Ожидалось: ${s.expectedAnswer}, Пользователь ввёл: ${
              user.stepAnswers?.[s.order] || user.stepAnswers?.[(s as any).id] || "не введено"
            })`
        )
        .join("\n")
    : "";

  const userPrompt = `Задача: "${question.title}"
Условие: ${question.questionText}
${question.latex ? `Формула/выражение: ${question.latex}` : ""}
${stepsInfo ? `\nШаги задачи и ответы пользователя:\n${stepsInfo}` : ""}
${user.userAnswer ? `Общий ответ пользователя: ${user.userAnswer}` : ""}
${userNotes ? `Комментарий/ход решения ученика: "${userNotes}"` : ""}

Запрос: Проверь ход рассуждений ученика.
- Если есть верные шаги — похвали и подтверди их.
- Если есть ошибка или неточность — мягко укажи на конкретный момент (например: "обрати внимание на знак в шаге 2"), задай наводящий вопрос.
- Не выдавай финальный числовой ответ сразу.`;

  return { system, user: userPrompt };
}

/**
 * Prompt for explaining theory formula on the theory page.
 */
export function buildExplainFormulaPrompt(
  formulaLatex: string,
  formulaName: string | undefined,
  topicName: string,
  user: UserContext
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  const userPrompt = `Тема теории: ${topicName}
Формула / правило: ${formulaLatex}
${formulaName ? `Название: ${formulaName}` : ""}

Запрос: Ученик нажал кнопку "Не понял / Түсінбедім" рядом с этой формулой.
Объясни коротко и доступно:
1. Что означает эта формула простыми словами (что в ней каждый символ: основание, степень, показатель и т.д.)?
2. В каких ситуациях на ЕНТ её нужно применять?
3. Как в условии задания распознать, что нужна именно эта формула?
4. Один короткий наглядный числовой пример с вычислением.
Сделай объяснение компактным, живым и понятным.`;

  return { system, user: userPrompt };
}

/**
 * Prompt for structured error analysis.
 */
export function buildErrorAnalysisPrompt(
  question: QuestionContext,
  user: UserContext
): { system: string; user: string } {
  const system = `Ты — экспертный аналитик математических ошибок для ЕНТ ТиПО.
Твоя задача — точно классифицировать ошибку ученика и вернуть СТРОГО валидный JSON по указанной схеме.
Не включай в ответ никаких markdown-обёрток, кроме чистого JSON, или отвечай чистым JSON.
Язык текстовых полей: ${user.language === "kk" ? "қазақ тілі" : user.language === "en" ? "English" : "русский язык"}.`;

  const previousSkills = user.previousWeakSkills?.length
    ? `Предыдущие слабые навыки ученика: ${user.previousWeakSkills.join(", ")}`
    : "Предыдущих зафиксированных слабых навыков нет.";

  const userPrompt = `Контекст задачи:
Тема: ${question.topicName}
Подтема: ${question.subtopicName || "Общая"}
Сложность: ${question.difficulty} из 5
Задача: ${question.title}
Условие: ${question.questionText}
${question.latex ? `LaTeX: ${question.latex}` : ""}
Правильный ответ: ${question.correctAnswer || "Не указан"}
Ответ пользователя: ${user.userAnswer || "Пустой или неверный"}
${previousSkills}
Текущий mastery score: ${user.masteryScore}%

Проанализируй, почему ученик ошибся.
Верни строго JSON объект следующей структуры:
{
  "errorType": "string (один из: wrong_formula | calculation_error | sign_error | algebra_error | domain_error | concept_error | incorrect_method | fractional_exponent | power_rules | root_properties)",
  "weakSkill": "string (короткий идентификатор или название навыка на английском/русском, например: fractional_exponents, sign_rules, quadratic_formula, domain_restriction)",
  "reason": "string (1-2 предложения: конкретная причина ошибки, что именно перепутал ученик)",
  "shortExplanation": "string (понятное объяснение сути правила, 2-4 предложения, с LaTeX если нужно)",
  "hint": "string (короткий совет, на что обратить внимание при повторном решении)",
  "recommendedAction": "practice" | "repeat_theory" | "review_examples",
  "recommendedDifficulty": 1 | 2 | 3 | 4 | 5
}`;

  return { system, user: userPrompt };
}

/**
 * Prompt for generating similar practice question.
 */
export function buildSimilarQuestionPrompt(
  question: QuestionContext,
  user: UserContext
): { system: string; user: string } {
  const system = `Ты — методист по математике для ЕНТ ТиПО.
Создай ОДНУ аналогичную тренировочную задачу по той же математической механике, но с другими числовыми значениями.
Задача должна проверять тот же навык, иметь схожую сложность.
Верни ответ СТРОГО в формате JSON без постороннего текста.
Язык текстовых полей: ${user.language === "kk" ? "қазақ тілі" : user.language === "en" ? "English" : "русский язык"}.`;

  const userPrompt = `Исходная задача:
Тема: ${question.topicName}
Сложность: ${question.difficulty} из 5
Условие: ${question.questionText}
${question.latex ? `LaTeX: ${question.latex}` : ""}
Правильный ответ: ${question.correctAnswer}

Создай похожую задачу и верни JSON следующего вида:
{
  "title": "string (краткий заголовок задачи)",
  "questionText": "string (условие задачи)",
  "latex": "string (математическое выражение задачи в LaTeX, например \\\\sqrt{50} + \\\\sqrt{18})",
  "hint": "string (подсказка для ученика)",
  "expectedAnswer": "string (точный математический ответ, например 8\\\\sqrt{2} или 14)",
  "explanation": "string (краткое решение и ответ)"
}`;

  return { system, user: userPrompt };
}

/**
 * Prompt for freeform tutor chat in the context of the question.
 */
export function buildChatPrompt(
  question: QuestionContext,
  user: UserContext,
  userMessage: string
): { system: string; user: string } {
  const system = getBaseSystemPrompt(user.language, user.masteryScore);

  const userPrompt = `Контекст текущей задачи:
Тема: ${question.topicName}
Задача: "${question.title}"
Условие: ${question.questionText}
${question.latex ? `LaTeX: ${question.latex}` : ""}
${user.userAnswer ? `Текущий ответ пользователя: ${user.userAnswer}` : ""}

Вопрос / реплика ученика к преподавателю:
"${userMessage}"

Ответь ученику дружелюбно, ёмко и понятно, придерживаясь роли персонального преподавателя ЕНТ. Используй LaTeX для математики.`;

  return { system, user: userPrompt };
}
