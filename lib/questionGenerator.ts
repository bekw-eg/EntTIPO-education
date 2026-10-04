/**
 * Algorithmic Question Variant Generator for ENT Math Prep.
 * Generates mathematically consistent questions with randomized coefficients,
 * step-by-step solutions, multiple-choice options, hints, and explanations across all 15 topics.
 */

import { PRACTICE_EXERCISES, SkillId } from "./skillCatalog";

export interface GeneratedStepOption {
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface GeneratedStep {
  order: number;
  type: "multiple_choice" | "numeric_input" | "expression_input";
  prompt: string;
  expectedAnswer: string;
  hint: string;
  options: GeneratedStepOption[];
  skillIds?: string[];
}

export interface GeneratedQuestion {
  topicId: string;
  subtopicId?: string;
  skillTag?: string;
  weakSkill?: string;
  skillIds?: string[];
  title: string;
  questionText: string;
  latex?: string;
  difficulty: number;
  correctAnswer: string;
  answerType: "multiple_choice" | "number" | "expression";
  explanation: string;
  steps: GeneratedStep[];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── TOPIC GENERATORS ────────────────────────────────────────────────────────

// 1. Корни и степени
export function generateRootsAndPowers(index = 1): GeneratedQuestion {
  const a = randInt(2, 5);
  const m = randInt(2, 4);
  const n = randInt(2, 3);
  const power = m + n;
  const result = Math.pow(a, power);

  return {
    topicId: "t1",
    skillTag: "roots_and_powers",
    skillIds: ["power_properties"],
    weakSkill: "свойства_степеней",
    title: `Упрощение выражений со степенями #${index}`,
    questionText: `Вычислите значение числового выражения применив свойства степеней:`,
    latex: `${a}^{${m}} \\cdot ${a}^{${n}}`,
    difficulty: m > 2 ? 2 : 1,
    correctAnswer: `${result}`,
    answerType: "number",
    explanation: `При умножении степеней с одинаковым основанием основание оставляем прежним, а показатели складываем: ${a}^${m} * ${a}^${n} = ${a}^(${m}+${n}) = ${a}^${power} = ${result}.`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: "Какое базовое свойство степеней применяется для умножения?",
        skillIds: ["power_properties"],
        expectedAnswer: "a^m * a^n = a^(m+n)",
        hint: "При одинаковом основании показатели складываются.",
        options: [
          { text: "a^m * a^n = a^(m+n)", isCorrect: true, order: 1 },
          { text: "a^m * a^n = a^(m*n)", isCorrect: false, order: 2 },
          { text: "a^m * a^n = (2a)^(m+n)", isCorrect: false, order: 3 },
          { text: "a^m * a^n = a^(m-n)", isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Сложите показатели степеней: ${m} + ${n} = ?`,
        expectedAnswer: `${power}`,
        hint: "Просто сложите два целых числа.",
        options: [],
      },
      {
        order: 3,
        type: "numeric_input",
        prompt: `Вычислите итоговое значение ${a}^${power}:`,
        expectedAnswer: `${result}`,
        hint: `Возведите ${a} в степень ${power}.`,
        options: [],
      },
    ],
  };
}

// 2. Многочлены
export function generatePolynomials(index = 1): GeneratedQuestion {
  const p = randInt(2, 7);
  const b = p * 2;
  const c = p * p;

  return {
    topicId: "t2",
    skillTag: "polynomials_expansion",
    weakSkill: "формулы_сокращенного_умножения",
    title: `Формула квадрата двучлена #${index}`,
    questionText: `Раскройте скобки по формуле квадрата суммы:`,
    latex: `(x + ${p})^2`,
    difficulty: 2,
    correctAnswer: `x^2 + ${b}*x + ${c}`,
    answerType: "expression",
    explanation: `По формуле квадрата суммы (a+b)^2 = a^2 + 2ab + b^2: x^2 + 2*${p}*x + ${p}^2 = x^2 + ${b}x + ${c}.`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: "Выберите формулу квадрата суммы двучлена:",
        expectedAnswer: "a^2 + 2ab + b^2",
        hint: "Не забывайте про удвоенное произведение!",
        options: [
          { text: "a^2 + 2ab + b^2", isCorrect: true, order: 1 },
          { text: "a^2 + b^2", isCorrect: false, order: 2 },
          { text: "a^2 - 2ab + b^2", isCorrect: false, order: 3 },
          { text: "2a + 2b", isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Чему равен коэффициент при x (удвоенное произведение 2 * ${p})?`,
        expectedAnswer: `${b}`,
        hint: `Умножьте 2 на ${p}.`,
        options: [],
      },
      {
        order: 3,
        type: "expression_input",
        prompt: "Запишите итоговый многочлен в развернутом виде:",
        expectedAnswer: `x^2 + ${b}*x + ${c}`,
        hint: `x^2 + ${b}*x + ${c}`,
        options: [],
      },
    ],
  };
}

// 3. Комплексные числа
export function generateComplexNumbers(index = 1): GeneratedQuestion {
  const re1 = randInt(1, 6);
  const im1 = randInt(1, 6);
  const re2 = randInt(1, 6);
  const im2 = randInt(1, 6);
  const sumRe = re1 + re2;
  const sumIm = im1 + im2;

  return {
    topicId: "t3",
    skillTag: "complex_numbers",
    weakSkill: "комплексные_числа",
    title: `Сложение комплексных чисел #${index}`,
    questionText: `Найдите сумму комплексных чисел:`,
    latex: `z_1 = ${re1} + ${im1}i, \\quad z_2 = ${re2} + ${im2}i`,
    difficulty: 2,
    correctAnswer: `${sumRe} + ${sumIm}*i`,
    answerType: "expression",
    explanation: `Складываем действительные части: ${re1} + ${re2} = ${sumRe}, и мнимые части: (${im1} + ${im2})i = ${sumIm}i. Получаем: ${sumRe} + ${sumIm}i.`,
    steps: [
      {
        order: 1,
        type: "numeric_input",
        prompt: `Сложите действительные части (${re1} + ${re2}):`,
        expectedAnswer: `${sumRe}`,
        hint: "Сложите целые действительные коэффициенты.",
        options: [],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Сложите мнимые части при i (${im1} + ${im2}):`,
        expectedAnswer: `${sumIm}`,
        hint: "Сложите коэффициенты перед i.",
        options: [],
      },
      {
        order: 3,
        type: "multiple_choice",
        prompt: "Какой итоговый результат в стандартной форме z = a + bi?",
        expectedAnswer: `${sumRe} + ${sumIm}i`,
        hint: "Запишите сумму a + bi.",
        options: [
          { text: `${sumRe} + ${sumIm}i`, isCorrect: true, order: 1 },
          { text: `${sumRe - 1} + ${sumIm}i`, isCorrect: false, order: 2 },
          { text: `${sumRe * 2}i`, isCorrect: false, order: 3 },
          { text: `${sumRe} - ${sumIm}i`, isCorrect: false, order: 4 },
        ],
      },
    ],
  };
}

// 4. Производная
export function generateDerivative(index = 1): GeneratedQuestion {
  const k = randInt(2, 6);
  const n = randInt(2, 4);
  const newK = k * n;
  const newN = n - 1;

  const expectedStr = newN === 1 ? `${newK}*x` : `${newK}*x^${newN}`;

  return {
    topicId: "t4",
    skillTag: "power_rule_derivative",
    weakSkill: "вычисление_производной",
    title: `Производная степенной функции #${index}`,
    questionText: `Найдите производную функции f(x):`,
    latex: `f(x) = ${k}x^{${n}}`,
    difficulty: 2,
    correctAnswer: expectedStr,
    answerType: "expression",
    explanation: `По правилу дифференцирования (k * x^n)' = k * n * x^(n-1). Имеем: ${k} * ${n} * x^(${n}-1) = ${newK}x^${newN}.`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: "Какова общая формула производной (x^n)'?",
        expectedAnswer: "n*x^(n-1)",
        hint: "Степень спускается вперед коэффициентом, а показатель уменьшается на единицу.",
        options: [
          { text: "n*x^(n-1)", isCorrect: true, order: 1 },
          { text: "x^(n+1) / (n+1)", isCorrect: false, order: 2 },
          { text: "n*x^n", isCorrect: false, order: 3 },
          { text: "(n-1)*x^n", isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Вычислите новый числовой коэффициент ${k} * ${n}:`,
        expectedAnswer: `${newK}`,
        hint: `Умножьте ${k} на ${n}.`,
        options: [],
      },
      {
        order: 3,
        type: "expression_input",
        prompt: "Запишите полную формулу производной f'(x):",
        expectedAnswer: expectedStr,
        hint: `${newK}*x^${newN}`,
        options: [],
      },
    ],
  };
}

// 5. Касательная к графику
export function generateTangent(index = 1): GeneratedQuestion {
  const a = randInt(1, 3);
  const x0 = randInt(1, 3);
  // f(x) = a * x^2
  // f(x0) = a * x0^2
  // f'(x) = 2*a*x -> f'(x0) = 2*a*x0
  // y = f(x0) + f'(x0)(x - x0) = 2*a*x0*x + (f(x0) - 2*a*x0^2) = 2*a*x0*x - a*x0^2
  const fx0 = a * x0 * x0;
  const slope = 2 * a * x0;
  const intercept = fx0 - slope * x0;

  return {
    topicId: "t5",
    skillTag: "tangent_equation",
    weakSkill: "уравнение_касательной",
    title: `Уравнение касательной к параболе #${index}`,
    questionText: `Составьте уравнение касательной к графику функции в заданной точке:`,
    latex: `f(x) = ${a === 1 ? "" : a}x^2, \\quad x_0 = ${x0}`,
    difficulty: 3,
    correctAnswer: `y = ${slope}*x ${intercept < 0 ? `- ${Math.abs(intercept)}` : `+ ${intercept}`}`,
    answerType: "expression",
    explanation: `1) f(x_0) = ${fx0}. 2) f'(x) = ${2 * a}x, значит f'(${x0}) = ${slope}. 3) Уравнение касательной y = f(x_0) + f'(x_0)(x - x_0) = ${fx0} + ${slope}(x - ${x0}) = ${slope}x + (${intercept}).`,
    steps: [
      {
        order: 1,
        type: "numeric_input",
        prompt: `Вычислите значение функции в точке f(${x0}):`,
        expectedAnswer: `${fx0}`,
        hint: `Подставьте x = ${x0} в функцию ${a} * x^2.`,
        options: [],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Найдите угловой коэффициент касательной k = f'(${x0}):`,
        expectedAnswer: `${slope}`,
        hint: `f'(x) = ${2 * a}x, подставьте x0 = ${x0}.`,
        options: [],
      },
      {
        order: 3,
        type: "multiple_choice",
        prompt: "Какое итоговое уравнение касательной получается?",
        expectedAnswer: `y = ${slope}x ${intercept < 0 ? `- ${Math.abs(intercept)}` : `+ ${intercept}`}`,
        hint: `Раскройте скобки в y = ${fx0} + ${slope}(x - ${x0}).`,
        options: [
          { text: `y = ${slope}x ${intercept < 0 ? `- ${Math.abs(intercept)}` : `+ ${intercept}`}`, isCorrect: true, order: 1 },
          { text: `y = ${slope}x + ${fx0}`, isCorrect: false, order: 2 },
          { text: `y = ${slope + 1}x - ${x0}`, isCorrect: false, order: 3 },
          { text: `y = ${fx0}x + ${slope}`, isCorrect: false, order: 4 },
        ],
      },
    ],
  };
}

// 7. Интегралы
export function generateIntegrals(index = 1): GeneratedQuestion {
  const m = randInt(2, 4);
  const b = randInt(1, 3);
  // int_0^b (m*x) dx = [m*x^2 / 2]_0^b = m * b^2 / 2
  const num = m * b * b;
  const isEven = num % 2 === 0;
  const resStr = isEven ? `${num / 2}` : `${num}/2`;

  return {
    topicId: "t7",
    skillTag: "definite_integrals",
    weakSkill: "вычисление_интегралов",
    title: `Определённый интеграл линейной функции #${index}`,
    questionText: `Вычислите определённый интеграл по формуле Ньютона-Лейбница:`,
    latex: `\\int_{0}^{${b}} ${m}x \\, dx`,
    difficulty: 3,
    correctAnswer: resStr,
    answerType: "number",
    explanation: `Первообразная: F(x) = (${m}/2) * x^2. По формуле Ньютона-Лейбница: F(${b}) - F(0) = (${m}/2)*${b}^2 - 0 = ${resStr}.`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: `Чему равна первообразная функции f(x) = ${m}x?`,
        expectedAnswer: `${m}/2 * x^2`,
        hint: "Интеграл от x равен x^2 / 2.",
        options: [
          { text: `${m}/2 * x^2`, isCorrect: true, order: 1 },
          { text: `${m} * x`, isCorrect: false, order: 2 },
          { text: `${m} * x^2`, isCorrect: false, order: 3 },
          { text: `${m * 2} * x`, isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Подставьте верхний предел x = ${b} и найдите результат:`,
        expectedAnswer: resStr,
        hint: `Вычислите (${m} * ${b}^2) / 2.`,
        options: [],
      },
    ],
  };
}

// 9. Логарифмы
export function generateLogarithms(index = 1): GeneratedQuestion {
  const base = pickRandom([2, 3, 5]);
  const power = randInt(2, 4);
  const arg = Math.pow(base, power);

  return {
    topicId: "t9",
    skillTag: "logarithm_properties",
    weakSkill: "свойства_логарифмов",
    title: `Вычисление логарифма по определению #${index}`,
    questionText: `Найдите значение логарифма:`,
    latex: `\\log_{${base}}(${arg})`,
    difficulty: 2,
    correctAnswer: `${power}`,
    answerType: "number",
    explanation: `По определению логарифма log_a(b) = c означает a^c = b. Так как ${base}^${power} = ${arg}, то log_${base}(${arg}) = ${power}.`,
    steps: [
      {
        order: 1,
        type: "numeric_input",
        prompt: `В какую степень нужно возвести основание ${base}, чтобы получить ${arg}?`,
        expectedAnswer: `${power}`,
        hint: `Проверьте: ${base} * ${base}... = ${arg}`,
        options: [],
      },
      {
        order: 2,
        type: "multiple_choice",
        prompt: "Выберите итоговый правильный ответ:",
        expectedAnswer: `${power}`,
        hint: "Значение логарифма равно найденному показателю.",
        options: [
          { text: `${power}`, isCorrect: true, order: 1 },
          { text: `${power + 1}`, isCorrect: false, order: 2 },
          { text: `${power - 1}`, isCorrect: false, order: 3 },
          { text: `${arg / base}`, isCorrect: false, order: 4 },
        ],
      },
    ],
  };
}

// 11. Тригонометрия
export function generateTrigonometry(index = 1): GeneratedQuestion {
  const angles = [
    { deg: "30^\\circ", rad: "\\pi/6", sin: "1/2", cos: "\\sqrt{3}/2" },
    { deg: "45^\\circ", rad: "\\pi/4", sin: "\\sqrt{2}/2", cos: "\\sqrt{2}/2" },
    { deg: "60^\\circ", rad: "\\pi/3", sin: "\\sqrt{3}/2", cos: "1/2" },
    { deg: "90^\\circ", rad: "\\pi/2", sin: "1", cos: "0" },
  ];
  const item = pickRandom(angles);

  return {
    topicId: "t11",
    skillTag: "trigonometry_values",
    weakSkill: "тригонометрические_функции",
    title: `Табличные значения тригонометрии #${index}`,
    questionText: `Найдите точное значение тригонометрической функции:`,
    latex: `\\sin(${item.rad})`,
    difficulty: 1,
    correctAnswer: item.sin,
    answerType: "expression",
    explanation: `Угол ${item.rad} соответствует ${item.deg}. Значение синуса по тригонометрической таблице равно ${item.sin}.`,
    steps: [
      {
        order: 1,
        type: "numeric_input",
        prompt: `Сколько градусов составляет угол ${item.rad}? (введите число градусов)`,
        expectedAnswer: item.deg.replace("^\\circ", ""),
        hint: "180 градусов = pi радиан.",
        options: [],
      },
      {
        order: 2,
        type: "multiple_choice",
        prompt: `Выберите точное значение sin(${item.rad}):`,
        expectedAnswer: item.sin,
        hint: "Вспомните стандартную таблицу значений синуса первой четверти.",
        options: [
          { text: item.sin, isCorrect: true, order: 1 },
          { text: item.sin === "1/2" ? "\\sqrt{2}/2" : "1/2", isCorrect: false, order: 2 },
          { text: "0", isCorrect: false, order: 3 },
          { text: "1", isCorrect: false, order: 4 },
        ],
      },
    ],
  };
}

// 14. ДУ второго порядка
export function generateDiffEq2(index = 1): GeneratedQuestion {
  const k1 = randInt(1, 4);
  const k2 = randInt(5, 8);
  const p = -(k1 + k2);
  const q = k1 * k2;

  return {
    topicId: "t14",
    skillTag: "second_order_diffeq",
    weakSkill: "дифференциальные_уравнения",
    title: `Характеристическое уравнение ДУ второго порядка #${index}`,
    questionText: `Найдите корни характеристического уравнения для дифференциального уравнения:`,
    latex: `y'' ${p < 0 ? `- ${Math.abs(p)}` : `+ ${p}`}y' + ${q}y = 0`,
    difficulty: 4,
    correctAnswer: `k_1 = ${k1}, k_2 = ${k2}`,
    answerType: "expression",
    explanation: `Составляем характеристическое уравнение: k^2 ${p < 0 ? `- ${Math.abs(p)}` : `+ ${p}`}k + ${q} = 0. По теореме Виета корни: k1 = ${k1}, k2 = ${k2}. Общее решение: y = C1*e^(${k1}x) + C2*e^(${k2}x).`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: "Как выглядит характеристическое уравнение для данного ДУ?",
        expectedAnswer: `k^2 ${p < 0 ? `- ${Math.abs(p)}` : `+ ${p}`}k + ${q} = 0`,
        hint: "Заменяем y'' на k^2, y' на k, y на 1.",
        options: [
          { text: `k^2 ${p < 0 ? `- ${Math.abs(p)}` : `+ ${p}`}k + ${q} = 0`, isCorrect: true, order: 1 },
          { text: `k^2 + ${q} = 0`, isCorrect: false, order: 2 },
          { text: `k ${p < 0 ? `- ${Math.abs(p)}` : `+ ${p}`} = 0`, isCorrect: false, order: 3 },
          { text: `k^2 + y' + y = 0`, isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "multiple_choice",
        prompt: "Найдите корни квадратного уравнения k^2 + pk + q = 0:",
        expectedAnswer: `k_1 = ${k1}, k_2 = ${k2}`,
        hint: `Сумма корней равна ${-p}, а произведение ${q}.`,
        options: [
          { text: `k_1 = ${k1}, k_2 = ${k2}`, isCorrect: true, order: 1 },
          { text: `k_1 = ${-k1}, k_2 = ${-k2}`, isCorrect: false, order: 2 },
          { text: `k_1 = ${k1 + 1}, k_2 = ${k2 - 1}`, isCorrect: false, order: 3 },
          { text: `k_1 = 0, k_2 = ${q}`, isCorrect: false, order: 4 },
        ],
      },
    ],
  };
}

// 16. Стереометрия (с геометрическим чертежом)
export function generateStereometry(index = 1): GeneratedQuestion {
  const a = randInt(4, 10) * 2; // четное число для удобного деления пополам
  const H = randInt(6, 15);
  const baseArea = a * a;
  const volume = Math.round((1 / 3) * baseArea * H);

  const geomConfig = {
    type: "pyramid_4",
    title: `Пирамида: H = ${H}, a = ${a}`,
    labels: { H: `${H}`, a: `${a}` },
    highlightPart: "height",
  };

  return {
    topicId: "t1", // or related
    skillTag: "stereometry_volume",
    weakSkill: "стереометрия_объемы",
    title: `Стереометрия: Объём правильной пирамиды #${index}`,
    questionText: `В правильной четырёхугольной пирамиде сторона основания равна ${a}, а высота равна ${H}. Найдите объём пирамиды.\n[GEOMETRY:${JSON.stringify(geomConfig)}]`,
    latex: `a = ${a}, \\quad H = ${H}`,
    difficulty: 3,
    correctAnswer: `${volume}`,
    answerType: "number",
    explanation: `1) Основание пирамиды — квадрат со стороной a = ${a}. Площадь основания: S_осн = a^2 = ${a}^2 = ${baseArea}. 2) Объём пирамиды вычисляется по формуле: V = (1/3) * S_осн * H = (1/3) * ${baseArea} * ${H} = ${volume}.`,
    steps: [
      {
        order: 1,
        type: "multiple_choice",
        prompt: "По какой формуле вычисляется объём пирамиды?",
        expectedAnswer: "V = (1/3) * S_осн * H",
        hint: "Объём любой пирамиды равен одной трети площади основания на высоту.",
        options: [
          { text: "V = (1/3) * S_осн * H", isCorrect: true, order: 1 },
          { text: "V = S_осн * H", isCorrect: false, order: 2 },
          { text: "V = (1/2) * S_осн * H", isCorrect: false, order: 3 },
          { text: "V = (4/3) * pi * R^3", isCorrect: false, order: 4 },
        ],
      },
      {
        order: 2,
        type: "numeric_input",
        prompt: `Вычислите площадь квадратного основания S_осн = ${a}^2:`,
        expectedAnswer: `${baseArea}`,
        hint: `Возведите ${a} в квадрат.`,
        options: [],
      },
      {
        order: 3,
        type: "numeric_input",
        prompt: `Вычислите итоговый объём пирамиды V = (1/3) * ${baseArea} * ${H}:`,
        expectedAnswer: `${volume}`,
        hint: `Умножьте ${baseArea} на ${H} и разделите на 3.`,
        options: [],
      },
    ],
  };
}

/**
 * Generates an array of diversified questions across all topics.
 */
export function generateQuestionsBatch(countPerTopic = 15): GeneratedQuestion[] {
  const result: GeneratedQuestion[] = [];
  const generators = [
    generateRootsAndPowers,
    generatePolynomials,
    generateComplexNumbers,
    generateDerivative,
    generateTangent,
    generateIntegrals,
    generateLogarithms,
    generateTrigonometry,
    generateDiffEq2,
    generateStereometry,
  ];

  for (let t = 0; t < generators.length; t++) {
    const gen = generators[t];
    for (let i = 1; i <= countPerTopic; i++) {
      result.push(gen(i));
    }
  }

  return result;
}

/**
 * Mapping from micro-skill tags to dedicated algorithmic generators.
 */
export const SKILL_GENERATOR_MAP: Record<string, (index?: number) => GeneratedQuestion> = {
  power_properties: generateRootsAndPowers,
  chain_rule: (index = 1) => generateCatalogPractice("chain_rule", index),
  bracket_signs: (index = 1) => generateCatalogPractice("bracket_signs", index),
  roots_and_powers: generateRootsAndPowers,
  свойства_степеней: generateRootsAndPowers,
  polynomials_expansion: generatePolynomials,
  формулы_сокращенного_умножения: generatePolynomials,
  формулы_многочленов: generatePolynomials,
  complex_numbers: generateComplexNumbers,
  комплексные_числа: generateComplexNumbers,
  power_rule_derivative: generateDerivative,
  вычисление_производной: generateDerivative,
  производная_функции: generateDerivative,
  tangent_equation: generateTangent,
  уравнение_касательной: generateTangent,
  definite_integrals: generateIntegrals,
  вычисление_интегралов: generateIntegrals,
  logarithm_properties: generateLogarithms,
  свойства_логарифмов: generateLogarithms,
  trigonometry_values: generateTrigonometry,
  тригонометрические_функции: generateTrigonometry,
  second_order_diffeq: generateDiffEq2,
  дифференциальные_уравнения: generateDiffEq2,
  stereometry_volume: generateStereometry,
  стереометрия_объемы: generateStereometry,
};

/**
 * Generates an algorithmic question targeting a student's specific unmastered skill.
 */
export function generateQuestionForSkill(
  skillTag: string,
  index = 1
): GeneratedQuestion | null {
  if (!skillTag) return null;
  const normalized = skillTag.toLowerCase().trim().replace(/[-\s]+/g, "_");
  const directGen = SKILL_GENERATOR_MAP[normalized] || SKILL_GENERATOR_MAP[skillTag];
  if (directGen) {
    return directGen(index);
  }

  return null;
}

function generateCatalogPractice(skillId: SkillId, index: number): GeneratedQuestion {
  const pool = PRACTICE_EXERCISES.filter((q) => q.steps.every((s) => s.skillIds.includes(skillId)));
  const q = pool[Math.abs(index) % pool.length];
  return { topicId: q.topicId, skillTag: skillId, skillIds: [skillId], weakSkill: q.title,
    title: q.title, questionText: q.questionText, explanation: q.explanation, difficulty: q.difficulty,
    correctAnswer: q.steps.at(-1)!.expectedAnswer, answerType: "expression",
    steps: q.steps.map((s, i) => ({ order: i + 1, type: "expression_input", prompt: s.prompt,
      expectedAnswer: s.expectedAnswer, hint: s.hint, options: [], skillIds: s.skillIds })) };
}

/**
 * Returns available micro-skills with their topic mappings.
 */
export function getAvailableSkills(): {
  skillTag: string;
  weakSkill: string;
  topicId: string;
  title: string;
}[] {
  return [
    { skillTag: "roots_and_powers", weakSkill: "свойства_степеней", topicId: "t1", title: "Корни и степени" },
    { skillTag: "polynomials_expansion", weakSkill: "формулы_сокращенного_умножения", topicId: "t2", title: "Многочлены" },
    { skillTag: "complex_numbers", weakSkill: "комплексные_числа", topicId: "t3", title: "Комплексные числа" },
    { skillTag: "power_rule_derivative", weakSkill: "вычисление_производной", topicId: "t4", title: "Производная" },
    { skillTag: "tangent_equation", weakSkill: "уравнение_касательной", topicId: "t5", title: "Касательная к графику" },
    { skillTag: "definite_integrals", weakSkill: "вычисление_интегралов", topicId: "t7", title: "Интегралы" },
    { skillTag: "logarithm_properties", weakSkill: "свойства_логарифмов", topicId: "t9", title: "Логарифмические функции" },
    { skillTag: "trigonometry_values", weakSkill: "тригонометрические_функции", topicId: "t11", title: "Тригонометрия" },
    { skillTag: "second_order_diffeq", weakSkill: "дифференциальные_уравнения", topicId: "t14", title: "ДУ второго порядка" },
    { skillTag: "stereometry_volume", weakSkill: "стереометрия_объемы", topicId: "t1", title: "Стереометрия" },
  ];
}
