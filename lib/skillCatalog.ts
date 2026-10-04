/** Stable identifiers and explicit, bilingual curriculum. No title inference. */
export const SKILLS = [
  {
    id: "power_properties", topicId: "t1", nameRu: "Свойства степеней", nameKk: "Дәрежелердің қасиеттері",
    explanationRu: "Умножение и деление степеней, степень степени и дробные показатели.",
    explanationKk: "Дәрежелерді көбейту және бөлу, дәрежені дәрежеге шығару және бөлшек көрсеткіштер.",
    ruleRu: "a^m · a^n = a^(m+n); a^m / a^n = a^(m−n), a ≠ 0; (a^m)^n = a^(mn). Для a > 0: a^(m/n) = (корень степени n из a)^m, n — положительное целое. Показатели складывают при умножении, но перемножают при возведении степени в степень.",
    ruleKk: "a^m · a^n = a^(m+n); a^m / a^n = a^(m−n), a ≠ 0; (a^m)^n = a^(mn). a > 0 үшін: a^(m/n) = (a санының n дәрежелі түбірі)^m, n — оң бүтін сан. Көбейткенде көрсеткіштер қосылады, дәрежені дәрежеге шығарғанда көбейтіледі.",
  },
  {
    id: "chain_rule", topicId: "t4", nameRu: "Цепное правило", nameKk: "Күрделі функцияның туындысы",
    explanationRu: "Производная сложной функции с учётом производной внутренней функции.",
    explanationKk: "Ішкі функцияның туындысын ескеріп, күрделі функцияның туындысын табу.",
    ruleRu: "(f(g(x)))′ = f′(g(x)) · g′(x). Например, ((3x+1)^2)′ = 2(3x+1) · 3. После производной внешней функции обязательно умножь на производную внутренней.",
    ruleKk: "(f(g(x)))′ = f′(g(x)) · g′(x). Мысалы, ((3x+1)^2)′ = 2(3x+1) · 3. Сыртқы функцияның туындысын ішкі функцияның туындысына міндетті түрде көбейт.",
  },
  {
    id: "bracket_signs", topicId: "t2", nameRu: "Знаки при раскрытии скобок", nameKk: "Жақшаларды ашудағы таңбалар",
    explanationRu: "Распределение отрицательного множителя на каждое слагаемое в скобках.",
    explanationKk: "Жақша ішіндегі әрбір қосылғышқа теріс көбейткішті үлестіру.",
    ruleRu: "−(a+b) = −a−b; −(a−b) = −a+b. Например, −2(x−3) = −2x+6. Минус перед скобками меняет знак каждого слагаемого.",
    ruleKk: "−(a+b) = −a−b; −(a−b) = −a+b. Мысалы, −2(x−3) = −2x+6. Жақша алдындағы минус әрбір қосылғыштың таңбасын өзгертеді.",
  },
] as const;

export type SkillId = typeof SKILLS[number]["id"];
export interface Misconception { answer: string; ru: string; kk: string }
export interface SkillExerciseStep {
  prompt: string; promptKk: string; expectedAnswer: string; skillIds: SkillId[];
  misconceptions: Misconception[]; hint: string;
}
export interface SkillExercise {
  id: string; topicId: string; purpose: "diagnostic" | "practice";
  title: string; titleKk: string; questionText: string; questionTextKk: string;
  explanation: string; explanationKk: string; difficulty: number;
  steps: SkillExerciseStep[];
}

function exercise(id: string, skillId: SkillId, expression: string, answer: string,
  explanation: string, explanationKk: string, misconceptions: Misconception[] = [], purpose: "diagnostic" | "practice" = "diagnostic"): SkillExercise {
  const skill = SKILLS.find((s) => s.id === skillId)!;
  const derivative = skillId === "chain_rule";
  const questionText = `${derivative ? "Найди производную" : "Упрости выражение"}: ${expression}`;
  const questionTextKk = `${derivative ? "Туындысын тап" : "Өрнекті ықшамда"}: ${expression}`;
  return { id, topicId: skill.topicId, purpose, title: skill.nameRu, titleKk: skill.nameKk,
    questionText, questionTextKk, explanation, explanationKk, difficulty: 1,
    steps: [{ prompt: "Запиши ответ", promptKk: "Жауабыңды жаз", expectedAnswer: answer,
      skillIds: [skillId], misconceptions, hint: skill.ruleRu }] };
}

export const DIAGNOSTIC_EXERCISES: SkillExercise[] = [
  exercise("diag_power_product", "power_properties", "x^3 · x^2 (x > 0)", "x^5",
    "Одинаковое основание: показатели складываем, 3 + 2 = 5. Ответ: x^5.",
    "Негіздері бірдей: көрсеткіштерді қосамыз, 3 + 2 = 5. Жауап: x^5.",
    [{ answer: "x^6", ru: "При умножении степеней ты перемножил показатели 3 и 2. Их нужно сложить.", kk: "Дәрежелерді көбейткенде 3 пен 2 көрсеткіштерін көбейттің. Оларды қосу керек." }]),
  exercise("diag_chain_linear", "chain_rule", "(3*x+1)^2", "6*(3*x+1)",
    "Внешняя производная: 2(3x+1). Внутренняя: 3. Умножаем: 6(3x+1).",
    "Сыртқы туынды: 2(3x+1). Ішкі туынды: 3. Көбейтеміз: 6(3x+1).",
    [{ answer: "2*(3*x+1)", ru: "Ты нашёл производную внешней функции, но не умножил на производную внутренней функции 3x+1, равную 3.", kk: "Сыртқы функцияның туындысын таптың, бірақ 3x+1 ішкі функциясының 3-ке тең туындысына көбейтпедің." }]),
  exercise("diag_sign_sum", "bracket_signs", "−(x+4)", "-x-4",
    "Минус меняет оба знака: −(x+4) = −x−4.", "Минус екі таңбаны да өзгертеді: −(x+4) = −x−4.",
    [{ answer: "-x+4", ru: "При раскрытии скобок ты не поменял знак второго слагаемого: +4 должно стать −4.", kk: "Жақшаны ашқанда екінші қосылғыштың таңбасын өзгертпедің: +4 саны −4 болуы керек." }]),
  exercise("diag_power_nested", "power_properties", "(x^2)^3", "x^6",
    "При возведении степени в степень показатели перемножаем: 2 · 3 = 6.", "Дәрежені дәрежеге шығарғанда көрсеткіштерді көбейтеміз: 2 · 3 = 6.",
    [{ answer: "x^5", ru: "Ты сложил показатели в степени степени. Здесь их нужно перемножить: 2 · 3 = 6.", kk: "Дәрежені дәрежеге шығарғанда көрсеткіштерді қостың. Мұнда көбейту керек: 2 · 3 = 6." }]),
  exercise("diag_chain_negative", "chain_rule", "(1-2*x)^3", "-6*(1-2*x)^2",
    "Внешняя производная: 3(1−2x)^2; внутренняя: −2. Ответ: −6(1−2x)^2.", "Сыртқы туынды: 3(1−2x)^2; ішкі туынды: −2. Жауап: −6(1−2x)^2.",
    [{ answer: "3*(1-2*x)^2", ru: "В ответе отсутствует множитель −2 — производная внутренней функции 1−2x.", kk: "Жауапта −2 көбейткіші жоқ: ол 1−2x ішкі функциясының туындысы." }]),
  exercise("diag_sign_difference", "bracket_signs", "−(2*x−5)", "-2*x+5",
    "Меняем знаки обоих слагаемых: −2x+5.", "Екі қосылғыштың да таңбаларын өзгертеміз: −2x+5.",
    [{ answer: "-2*x-5", ru: "При раскрытии скобок ты оставил −5. Минус перед скобками превращает −5 в +5.", kk: "Жақшаны ашқанда −5 санын өзгертпедің. Жақша алдындағы минус −5 санын +5-ке айналдырады." }]),
  exercise("diag_power_quotient", "power_properties", "x^7 / x^3 (x ≠ 0)", "x^4",
    "При делении показатели вычитаем: 7 − 3 = 4. Ответ: x^4.", "Бөлгенде көрсеткіштерді азайтамыз: 7 − 3 = 4. Жауап: x^4.",
    [{ answer: "x^10", ru: "При делении степеней ты сложил показатели. Нужно вычесть показатель знаменателя: 7−3.", kk: "Дәрежелерді бөлгенде көрсеткіштерді қостың. Бөлімнің көрсеткішін азайту керек: 7−3." }]),
  exercise("diag_chain_quadratic", "chain_rule", "(x^2+1)^2", "4*x*(x^2+1)",
    "Внешняя производная: 2(x^2+1); внутренняя: 2x. Ответ: 4x(x^2+1).", "Сыртқы туынды: 2(x^2+1); ішкі туынды: 2x. Жауап: 4x(x^2+1).",
    [{ answer: "2*(x^2+1)", ru: "Ты пропустил множитель 2x — производную внутренней функции x^2+1.", kk: "2x көбейткішін өткізіп жібердің: ол x^2+1 ішкі функциясының туындысы." }]),
  exercise("diag_sign_factor", "bracket_signs", "−3*(x−2)", "-3*x+6",
    "Умножаем каждое слагаемое на −3: −3x + (−3)(−2) = −3x+6.", "Әрбір қосылғышты −3-ке көбейтеміз: −3x + (−3)(−2) = −3x+6.",
    [{ answer: "-3*x-6", ru: "Ты получил −6 вместо +6. Произведение двух отрицательных чисел (−3)(−2) положительное.", kk: "+6 орнына −6 алдың. Екі теріс санның (−3)(−2) көбейтіндісі оң болады." }]),
];

export const PRACTICE_EXERCISES: SkillExercise[] = [
  exercise("practice_power_product", "power_properties", "x^4 · x^3 (x > 0)", "x^7", "Складываем показатели: 4+3=7.", "Көрсеткіштерді қосамыз: 4+3=7.", [], "practice"),
  exercise("practice_power_nested", "power_properties", "(x^3)^4", "x^12", "Перемножаем показатели: 3·4=12.", "Көрсеткіштерді көбейтеміз: 3·4=12.", [], "practice"),
  exercise("practice_power_quotient", "power_properties", "x^9 / x^4 (x ≠ 0)", "x^5", "Вычитаем показатели: 9−4=5.", "Көрсеткіштерді азайтамыз: 9−4=5.", [], "practice"),
  exercise("practice_chain_linear", "chain_rule", "(2*x+3)^2", "4*(2*x+3)", "2(2x+3) · 2 = 4(2x+3).", "2(2x+3) · 2 = 4(2x+3).", [], "practice"),
  exercise("practice_chain_negative", "chain_rule", "(2-3*x)^3", "-9*(2-3*x)^2", "3(2−3x)^2 · (−3) = −9(2−3x)^2.", "3(2−3x)^2 · (−3) = −9(2−3x)^2.", [], "practice"),
  exercise("practice_chain_quadratic", "chain_rule", "(x^2+2)^3", "6*x*(x^2+2)^2", "3(x^2+2)^2 · 2x = 6x(x^2+2)^2.", "3(x^2+2)^2 · 2x = 6x(x^2+2)^2.", [], "practice"),
  exercise("practice_sign_sum", "bracket_signs", "−(x+7)", "-x-7", "Меняем оба знака: −x−7.", "Екі таңбаны да өзгертеміз: −x−7.", [], "practice"),
  exercise("practice_sign_difference", "bracket_signs", "−(3*x−8)", "-3*x+8", "Минус перед −8 даёт +8: −3x+8.", "−8 алдындағы минус +8 береді: −3x+8.", [], "practice"),
  exercise("practice_sign_factor", "bracket_signs", "−4*(x−3)", "-4*x+12", "−4 · x + (−4)(−3) = −4x+12.", "−4 · x + (−4)(−3) = −4x+12.", [], "practice"),
  {
    id: "practice_power_and_signs", topicId: "t2", purpose: "practice", title: "Степени и знаки", titleKk: "Дәрежелер және таңбалар",
    questionText: "Упрости −(x^2 · x^3 + 4)", questionTextKk: "−(x^2 · x^3 + 4) өрнегін ықшамда",
    explanation: "Сначала x^2 · x^3 = x^5, затем −(x^5+4) = −x^5−4.",
    explanationKk: "Алдымен x^2 · x^3 = x^5, содан кейін −(x^5+4) = −x^5−4.", difficulty: 2,
    steps: [
      { prompt: "Упрости x^2 · x^3", promptKk: "x^2 · x^3 өрнегін ықшамда", expectedAnswer: "x^5", skillIds: ["power_properties"], misconceptions: [], hint: "Сложи показатели." },
      { prompt: "Раскрой скобки в −(x^5+4)", promptKk: "−(x^5+4) өрнегіндегі жақшаны аш", expectedAnswer: "-x^5-4", skillIds: ["bracket_signs"],
        misconceptions: [{ answer: "-x^5+4", ru: "При раскрытии скобок ты не поменял знак второго слагаемого: +4 должно стать −4.", kk: "Жақшаны ашқанда екінші қосылғыштың таңбасын өзгертпедің: +4 саны −4 болуы керек." }], hint: "Минус меняет каждый знак." },
    ],
  },
];

export const DIAGNOSTIC_QUESTION_IDS = DIAGNOSTIC_EXERCISES.map((q) => q.id);

/** Follow-up operations are authored explicitly, never inferred from a task's wording. */
export const DIAGNOSTIC_FOLLOWUPS: Record<string, string> = {
  diag_power_product: "practice_power_product", diag_power_nested: "practice_power_nested", diag_power_quotient: "practice_power_quotient",
  diag_chain_linear: "practice_chain_linear", diag_chain_negative: "practice_chain_negative", diag_chain_quadratic: "practice_chain_quadratic",
  diag_sign_sum: "practice_sign_sum", diag_sign_difference: "practice_sign_difference", diag_sign_factor: "practice_sign_factor",
};
