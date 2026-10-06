import { Prisma } from "@prisma/client";
import { choiceSchema, optionId, type PracticeChoice } from "./practiceChoice";
import { validateExpressionOffline } from "./mathEngine";
import { choiceLatex, choiceStem } from "./choiceDisplay";
import { EXAM_EXERCISES } from "./exam/bank";

type Source = {
  id: string; topicId?: string; questionText: string; questionTextKk?: string | null; latex?: string | null;
  correctAnswer: string; explanation: string; explanationKk?: string | null;
  skills?: { skillId: string }[];
  steps: { prompt: string; promptKk?: string | null; expectedAnswer: string; skills?: { skillId: string }[]; misconceptions?: Prisma.JsonValue }[];
};

const hints: Record<string, [string, string]> = {
  t1: ["Определи, нужно ли сложить, вычесть или перемножить показатели. Сначала упрости выражение, затем вычисляй.", "Көрсеткіштерді қосу, азайту немесе көбейту керек екенін анықта. Алдымен өрнекті ықшамдап, кейін есепте."],
  t2: ["Раскрой скобки и сравни коэффициенты при одинаковых степенях.", "Жақшаларды ашып, бірдей дәрежелердің коэффициенттерін салыстыр."],
  t3: ["Отдельно работай с действительной и мнимой частями; i² = −1.", "Нақты және жорамал бөліктерді бөлек есепте; i² = −1."],
  t4: ["Выбери правило дифференцирования. Для сложной функции учти производную внутренней функции.", "Туынды табу ережесін таңда. Күрделі функцияда ішкі функцияның туындысын ескер."],
  t5: ["Касательная проходит через заданную точку; её наклон равен производной в этой точке.", "Жанама берілген нүктеден өтеді; көлбеулігі сол нүктедегі туындыға тең."],
  t9: ["Используй определение логарифма как показателя степени.", "Логарифмнің дәреже көрсеткіші ретіндегі анықтамасын қолдан."],
  t11: ["Используй единичную окружность; проверь угол и знак функции.", "Бірлік шеңберді қолдан; бұрыш пен функцияның таңбасын тексер."],
};
const defaultHint: [string, string] = ["Вспомни правило для этой темы и проверь результат подстановкой или обратным действием.", "Осы тақырыптың ережесін еске түсіріп, нәтижені орнына қою немесе кері амал арқылы тексер."];

// Complete fifth distractors for the training adapter only. Official four-option steps are immutable.
export const examFifth: Record<string, [string, string?]> = {
  integral_linearity: ["-x^4+3*x^2-2*x+C"], ode_separable_initial: ["y=3*exp(-x^2)"],
  ode_repeated_initial: ["y=(1-2*x)*exp(-2*x)"], rational_center: ["(-1; -2)"],
  rational_range: ["Все действительные, кроме 0", "0-ден басқа барлық нақты сандар"],
  inverse_arcsin: ["0"], inverse_range: ["3"], trig_equation: ["{2*pi/3; 4*pi/3}"],
  trig_inequality: ["(pi/3; 2*pi/3)"], trig_scaled: ["[0; pi/4] ∪ [3*pi/4; 5*pi/4] ∪ [7*pi/4; 2*pi]"],
  poly_standard: ["x^2+3*y^2"], poly_classify: ["Однородный степени 4, симметричный", "4-дәрежелі біртекті, симметриялы"],
  root_absolute: ["14"], root_rationalize: ["sqrt(5)+4"], exp_points: ["-1/3"],
  exp_decreasing: ["Функция постоянна и положительна", "Функция тұрақты және оң"],
  log_points: ["-1/2"], log_shift: ["x>-3; x=-3"], derivative_fraction: ["3/2"],
  tangent_inverse: ["y=-x+1"], integral_exponential: ["-2*exp(3*x)+C"], complex_division: ["2+4*i"],
  cylinder_total: ["39π см²"], cylinder_net: ["4π см"], cylinder_inverse: ["20 см"],
  cone_total: ["25π см²"], cone_sector: ["6 см"], cone_inverse: ["20 см"],
  prism_oblique: ["120 см³"], pyramid_frustum: ["294 см³"], cylinder_volume: ["72π см³"],
  cone_volume_height: ["25π см³"], cone_frustum: ["84π см³"],
};

const legacyFormula: Record<string, [string, string, string]> = {
  q1_t1: ["Упростите", "Ықшамдаңыз", "(sqrt(75)-sqrt(48))/sqrt(3)"],
  q2_t1: ["Вычислите", "Есептеңіз", "27^(2/3)"], q3_t1: ["Упростите при x > 0", "x > 0 үшін ықшамдаңыз", "x^(3/2)*x^(1/2)"],
  q1_t2: ["Разложите на множители", "Көбейткіштерге жіктеңіз", "x^2-5*x+6"],
  q2_t2: ["Вычислите при x = 1", "x = 1 үшін есептеңіз", "(2*x+3)^2"], q3_t2: ["Упростите при x ≠ 2", "x ≠ 2 үшін ықшамдаңыз", "(x^3-8)/(x-2)"],
  q1_t3: ["Вычислите (i² = −1)", "Есептеңіз (i² = −1)", "(2+3*i)*(2-3*i)"], q2_t3: ["Найдите модуль", "Модулін табыңыз", "3+4*i"],
  q1_t4: ["Найдите производную", "Туындысын табыңыз", "f(x)=x^3+2*x^2-5*x+1"],
  q2_t4: ["Найдите производную", "Туындысын табыңыз", "f(x)=sin(x)*exp(x)"], q3_t4: ["Найдите производную", "Туындысын табыңыз", "f(x)=ln(x^2+1)"],
  q1_t5: ["Найдите касательную при x₀ = 2", "x₀ = 2 үшін жанаманы табыңыз", "f(x)=x^2"],
  q1_t6: ["Найдите общий вид первообразных", "Алғашқы функциялардың жалпы түрін табыңыз", "f(x)=3*x^2+2*x"],
  q2_t6: ["Найдите общий вид первообразных на x ≠ 0", "x ≠ 0 үшін алғашқы функциялардың жалпы түрін табыңыз", "f(x)=1/x"],
  q1_t7: ["Вычислите интеграл", "Интегралды есептеңіз", "\\int_0^2 x^2\\,dx"],
  q2_t7: ["Найдите общий вид первообразных", "Алғашқы функциялардың жалпы түрін табыңыз", "f(x)=5*exp(2*x)"],
  q3_t7: ["Найдите общий вид первообразных", "Алғашқы функциялардың жалпы түрін табыңыз", "f(x)=cos(x)"],
  q1_t8: ["Найдите общий вид первообразных", "Алғашқы функциялардың жалпы түрін табыңыз", "f(x)=exp(x)*sin(x)"],
  q2_t8: ["Найдите общий вид первообразных", "Алғашқы функциялардың жалпы түрін табыңыз", "f(x)=x*exp(x)"],
  q1_t9: ["Вычислите", "Есептеңіз", "\\log_2(32)"], q2_t9: ["Вычислите", "Есептеңіз", "ln(exp(3))"],
  q3_t9: ["Решите уравнение", "Теңдеуді шешіңіз", "\\log_3(x+2)=2"],
  q1_t10: ["Решите уравнение", "Теңдеуді шешіңіз", "2^x=32"], q2_t10: ["Решите уравнение", "Теңдеуді шешіңіз", "3^(x+1)=27"],
  q1_t11: ["Вычислите", "Есептеңіз", "sin(x)^2+cos(x)^2"], q2_t11: ["Вычислите", "Есептеңіз", "sin(30^\\circ)"],
  q3_t11: ["Найдите все решения на [0; 2π]", "[0; 2π] аралығындағы барлық шешімдерді табыңыз", "sin(x)=0"],
  q1_t12: ["Вычислите в радианах", "Радианмен есептеңіз", "arcsin(1/2)"], q2_t12: ["Вычислите в радианах", "Радианмен есептеңіз", "arctan(1)"],
  q1_t13: ["Найдите общее решение", "Жалпы шешімін табыңыз", "y'=2*x"], q2_t13: ["Найдите общее решение", "Жалпы шешімін табыңыз", "y'+y=0"],
  q1_t14: ["Найдите общее решение", "Жалпы шешімін табыңыз", "y''-y=0"],
  q1_t15: ["Найдите область определения", "Анықталу облысын табыңыз", "f(x)=1/(x-3)"],
  q2_t15: ["Найдите вертикальную асимптоту", "Вертикаль асимптотасын табыңыз", "f(x)=(x+1)/(x-2)"],
};

// Four authored misconceptions for every original exercise. These never modify legacy/exam answers.
const legacy: Record<string, string[]> = {
  q1_t1: ["3", "sqrt(27)", "9", "sqrt(3)"],
  q2_t1: ["3", "18", "81", "27"], q3_t1: ["x^(3/4)", "x", "2*x^2", "x^3"],
  q1_t2: ["(x+2)*(x+3)", "(x-1)*(x-6)", "(x-2)*(x+3)", "(x+2)*(x-3)"],
  q2_t2: ["13", "10", "5", "49"], q3_t2: ["x^2-2*x+4", "x^2+4", "x^2+2*x-4", "x^2-4"],
  q1_t3: ["-5", "5", "25", "4"], q2_t3: ["7", "25", "1", "sqrt(7)"],
  q1_t4: ["3*x^2+2*x-5", "x^2+4*x-5", "3*x^2+4*x+5", "3*x^2+4*x-4"],
  q2_t4: ["cos(x)*exp(x)", "sin(x)*exp(x)", "cos(x)*exp(x)-sin(x)*exp(x)", "sin(x)*cos(x)*exp(x)"],
  q3_t4: ["1/(x^2+1)", "2*x/(x^2+1)^2", "2*x", "1/(2*x)"],
  q1_t5: ["y=4*x+4", "y=2*x", "y=4*x", "y=-4*x+12"],
  q1_t6: ["3*x^3+2*x^2+C", "6*x+2+C", "x^3+2*x^2+C", "x^3-x^2+C"],
  q2_t6: ["1/x+C", "-1/x^2+C", "-ln(abs(x))+C", "x^2/2+C"],
  q1_t7: ["4", "8", "2/3", "-8/3"],
  q2_t7: ["10*exp(2*x)+C", "5*exp(2*x)+C", "-5*exp(2*x)/2+C", "5*exp(x)/2+C"],
  q3_t7: ["-sin(x)+C", "cos(x)+C", "-cos(x)+C", "x*cos(x)+C"],
  q1_t8: ["exp(x)*(sin(x)+cos(x))/2+C", "exp(x)*(sin(x)-cos(x))+C", "-exp(x)*(sin(x)-cos(x))/2+C", "exp(x)*sin(x)+C"],
  q2_t8: ["exp(x)*(x+1)+C", "x*exp(x)+C", "exp(x)+C", "exp(x)*(1-x)+C"],
  q1_t9: ["16", "4", "6", "1/5"], q2_t9: ["exp(3)", "1/3", "1", "0"], q3_t9: ["9", "11", "4", "-7"],
  q1_t10: ["16", "4", "6", "1/5"], q2_t10: ["3", "4", "9", "1"],
  q1_t11: ["0", "2", "sin(x)+cos(x)", "cos(2*x)"], q2_t11: ["sqrt(3)/2", "sqrt(2)/2", "0", "1"],
  q3_t11: ["{0; pi}", "{pi; 2*pi}", "{pi/2; 3*pi/2}", "{0; 2*pi}"],
  q1_t12: ["pi/3", "pi/4", "5*pi/6", "pi/2"], q2_t12: ["pi/2", "pi/3", "3*pi/4", "0"],
  q1_t13: ["2*x^2+C", "x+C", "x^2/2+C", "2+C"],
  q2_t13: ["C*exp(x)", "-x+C", "C*exp(-2*x)", "C*x"],
  q1_t14: ["C1*exp(x)", "C1*cos(x)+C2*sin(x)", "(C1+C2*x)*exp(x)", "C1*x+C2"],
  q1_t15: ["x>3", "x<3", "x≠-3", "x∈R"], q2_t15: ["x=-1", "x=-2", "y=2", "y=1"],
};
const antiderivatives: Record<string, string> = {
  q1_t6: "x^3+x^2+C", q2_t6: "ln(abs(x))+C", q2_t7: "5*exp(2*x)/2+C", q3_t7: "sin(x)+C",
  q1_t8: "exp(x)*(sin(x)-cos(x))/2+C", q2_t8: "exp(x)*(x-1)+C",
};

// Explicit teaching annotations for these exact authored operations, not guessed from a failure.
const authoredErrors: Record<string, { correct: string; answer: string; skillId: string; ru: string; kk: string }> = {
  practice_power_product: { correct: "x^7", answer: "x^12", skillId: "power_properties",
    ru: "При умножении степеней с одинаковым основанием показатели складываются: 4+3=7. В выбранном варианте они перемножены.",
    kk: "Негіздері бірдей дәрежелерді көбейткенде көрсеткіштер қосылады: 4+3=7. Таңдалған нұсқада олар көбейтілген." },
  practice_power_nested: { correct: "x^12", answer: "x^7", skillId: "power_properties",
    ru: "При возведении степени в степень показатели перемножаются: 3·4=12. В выбранном варианте они сложены.",
    kk: "Дәрежені дәрежеге шығарғанда көрсеткіштер көбейтіледі: 3·4=12. Таңдалған нұсқада олар қосылған." },
  practice_power_quotient: { correct: "x^5", answer: "x^13", skillId: "power_properties",
    ru: "При делении степеней с одинаковым основанием показатели вычитаются: 9−4=5. В выбранном варианте они сложены.",
    kk: "Негіздері бірдей дәрежелерді бөлгенде көрсеткіштер азайтылады: 9−4=5. Таңдалған нұсқада олар қосылған." },
};

function skillDistractors(q: Source): string[] | null {
  const expression = q.questionText.split(": ").at(-1)!.replace(/−/g, "-").replace(/·/g, "*").replace(/\s*\(x [>≠].*?\)/g, "").replace(/\s/g, "");
  if (q.id === "practice_power_and_signs") return ["-x^5+4", "-x^6-4", "x^5+4", "-x^6+4"];
  if (/^(practice|daily|diag)_power/.test(q.id)) {
    const product = expression.match(/^x\^(\d+)\*x\^(\d+)$/);
    const nested = expression.match(/^\(x\^(\d+)\)\^(\d+)$/);
    const quotient = expression.match(/^x\^(\d+)\/x\^(\d+)$/);
    const combined = expression.match(/^\(x\^(\d+)\)\^(\d+)\*x\^(\d+)$/);
    if (product) { const [m,n] = product.slice(1).map(Number); return [`x^${m*n}`, `x^${m-n}`, `2*x^${m+n}`, `x^${m+n-1}`]; }
    if (nested) { const [m,n] = nested.slice(1).map(Number); return [`x^${m+n}`, `x^${m}`, `x^${n}`, `x^${m*n-1}`]; }
    if (quotient) { const [m,n] = quotient.slice(1).map(Number); return [`x^${m+n}`, `x^${n-m}`, `x^${m}`, `x^${m-n-1}`]; }
    if (combined) { const [m,n,p] = combined.slice(1).map(Number); return [`x^${m+n+p}`, `x^${m*n*p}`, `x^${m*n-p}`, `2*x^${m*n+p}`]; }
  }
  if (/^(practice|daily|diag)_(sign|bracket)/.test(q.id)) {
    // All authored sign exercises reduce to ax+b, with both coefficients nonzero.
    const answer = q.correctAnswer.replace(/\s/g, "");
    const match = answer.match(/^(-?\d*)\*?x([+-]\d+)$/);
    if (!match) return null;
    const a = Number(match[1] === "-" ? -1 : match[1] || 1), b = Number(match[2]);
    return [`${a}*x-${b}`, `${-a}*x+${b}`, `${-a}*x-${b}`, `${a}*x+${Math.sign(b)*Math.abs(b)/2}`];
  }
  if (/^(practice|daily|diag)_chain/.test(q.id)) {
    const match = expression.match(/^\((.*)\)\^(\d+)$/);
    if (!match) return null;
    const inner = match[1], n = Number(match[2]);
    return [`${n}*(${inner})^${n-1}`, `-(${q.correctAnswer})`, `(${q.correctAnswer})*(${inner})`, `${n}*(${inner})^${n}`];
  }
  return null;
}

function generatedDistractors(q: Source): string[] | null {
  const latex = q.latex ?? "";
  let m: RegExpMatchArray | null;
  if (q.questionText === "Вычислите значение числового выражения применив свойства степеней:" &&
    (m = latex.match(/^(\d+)\^\{(\d+)\} \\cdot (\d+)\^\{(\d+)\}$/)) && m[1] === m[3]) {
    const [a,p,,n] = m.slice(1).map(Number), value = a**(p+n);
    const mistakenExponent = a**(p*n === p+n ? p-n : p*n);
    // For 4^3·4^3, multiplying exponents and doubling the base coincide.
    // Use the independently meaningful subtraction-of-exponents error in that case.
    const mistakenBase = (2*a)**(p+n) === mistakenExponent ? a**(p-n) : (2*a)**(p+n);
    return [`${a**p+a**n}`, `${mistakenExponent}`, `${mistakenBase}`, `${-value}`];
  }
  if (q.questionText === "Раскройте скобки по формуле квадрата суммы:" && (m = latex.match(/^\(x \+ (\d+)\)\^2$/))) {
    const p = Number(m[1]); return [`x^2+${p*p}`, `x^2+${p}*x+${p*p}`, `x^2+${2*p}*x+${p}`, `x^2-${2*p}*x+${p*p}`];
  }
  if (q.questionText === "Найдите сумму комплексных чисел:" && (m = latex.match(/^z_1 = (\d+) \+ (\d+)i, \\quad z_2 = (\d+) \+ (\d+)i$/))) {
    const [a,b,c,d] = m.slice(1).map(Number); return [`${a+c}-${b+d}*i`, `${a-c}+${b+d}*i`, `${a+c}+${b-d}*i`, `${a+b+c+d}`];
  }
  if (q.questionText === "Найдите производную функции f(x):" && (m = latex.match(/^f\(x\) = (\d+)x\^\{(\d+)\}$/))) {
    const [k,n] = m.slice(1).map(Number); return [`${k}*x^${n-1}`, `${k*n}*x^${n}`, `-${k*n}*x^${n-1}`, `${k}*x^${n+1}/${n+1}`];
  }
  if (q.questionText === "Составьте уравнение касательной к графику функции в заданной точке:" && (m = latex.match(/^f\(x\) = (\d*)x\^2, \\quad x_0 = (\d+)$/))) {
    const a = Number(m[1] || 1), x = Number(m[2]), slope = 2*a*x, b = a*x*x;
    return [`y=${slope}*x+${b}`, `y=${slope}*x`, `y=-${slope}*x+${3*b}`, `y=${a*x}*x`];
  }
  if (q.questionText === "Вычислите определённый интеграл по формуле Ньютона-Лейбница:" && (m = latex.match(/^\\int_\{0\}\^\{(\d+)\} (\d+)x \\, dx$/))) {
    const [b,k] = m.slice(1).map(Number), num = k*b*b; return [`${num}`, `${-num}/2`, `${num}/3`, `${num}/4`];
  }
  if (q.questionText === "Найдите значение логарифма:" && (m = latex.match(/^\\log_\{(\d+)\}\((\d+)\)$/))) {
    const [a,b] = m.slice(1).map(Number), p = Number(q.correctAnswer);
    // Division happens to give the right answer for log_2(4). Use confusing
    // log(arg) with log(sqrt(arg)), rather than an accidentally correct distractor.
    return [`${b/a === p ? p/2 : b/a}`, `${1/p}`, `${-p}`, `${b}`];
  }
  if (q.questionText === "Найдите точное значение тригонометрической функции:" && latex.startsWith("\\sin(")) {
    const values = ["0", "1/2", "sqrt(2)/2", "sqrt(3)/2", "1", "-1"];
    return values.filter(v => !validateExpressionOffline(v, q.correctAnswer).isEquivalent).slice(0,4);
  }
  if (q.questionText === "Найдите корни характеристического уравнения для дифференциального уравнения:" && (m = q.correctAnswer.match(/^k_1 = (\d+), k_2 = (\d+)$/))) {
    const [a,b] = m.slice(1).map(Number); return [`k_1=${-a}, k_2=${-b}`, `k_1=${a}, k_2=${-b}`, `k_1=${-a}, k_2=${b}`, `k_1=0, k_2=${a+b}`];
  }
  if (q.questionText.startsWith("В правильной четырёхугольной пирамиде сторона основания равна") && (m = latex.match(/^a = (\d+), \\quad H = (\d+)$/))) {
    const [a,h] = m.slice(1).map(Number); return [`${a*a*h}`, `${a*a*h}/2`, `${a*h}/3`, `${4*a*h}/3`];
  }
  return null;
}

/** Older generated rows sometimes rounded pyramid volumes. Correct only the new adapter. */
function reviewedGeneratedSource(q: Source): Source {
  const match = q.questionText.startsWith("В правильной четырёхугольной пирамиде сторона основания равна")
    ? q.latex?.match(/^a = (\d+), \\quad H = (\d+)$/) : null;
  if (!match) return q;
  const [a,h] = match.slice(1).map(Number), numerator = a*a*h;
  const answer = numerator % 3 === 0 ? `${numerator/3}` : `${numerator}/3`;
  return { ...q, correctAnswer: answer,
    explanation: `Площадь квадратного основания: $S=${a}^2=${a*a}$. Объём пирамиды: $V=S H/3=${numerator}/3$. Точный ответ: ${answer}.`,
    explanationKk: `Квадрат табанның ауданы: $S=${a}^2=${a*a}$. Пирамиданың көлемі: $V=S H/3=${numerator}/3$. Дәл жауап: ${answer}.`,
    steps: q.steps.map((step,index)=>index===q.steps.length-1?{...step,expectedAnswer:answer}:step) };
}

/** No generic answer offsets or padding. Unrecognized/unreviewed content is quarantined. */
export function authorPracticeChoice(q: Source): PracticeChoice | null {
  q = reviewedGeneratedSource(q);
  const exam = EXAM_EXERCISES.find(e => e.id === q.id && e.text === q.questionText && e.options[e.correctIndex] === q.correctAnswer);
  const extra = exam ? examFifth[q.id.replace(/^exam_v1_/, "")] : undefined;
  const wrong = exam && extra ? [...exam.options.filter((_, index) => index !== exam.correctIndex), extra[0]] :
    legacy[q.id] ?? skillDistractors(q) ?? generatedDistractors(q);
  if (!wrong) return null;
  let correct = antiderivatives[q.id] ?? q.correctAnswer;
  if (q.id === "q3_t11") correct = "{0; pi; 2*pi}";
  const texts = [correct, ...wrong];
  // Conservative duplicate guard. Formal family-specific audits also verify the content.
  for (let i = 0; i < texts.length; i++) for (let j = i+1; j < texts.length; j++) {
    if (texts[i].replace(/\s/g, "") === texts[j].replace(/\s/g, "") ||
      validateExpressionOffline(texts[i], texts[j]).isEquivalent) return null;
  }
  const options = texts.map(text => ({ id: optionId(q.id, text), text,
    textKk: exam ? text === extra?.[0] ? extra[1] ?? text :
      (q.steps as { options?: { text: string; textKk?: string | null }[] }[]).flatMap(s => s.options ?? []).find(o => o.text === text)?.textKk ?? text : text }));
  for (const [index, text] of texts.entries()) {
    const authored = authoredErrors[q.id];
    const patterns = q.steps.flatMap(s => Array.isArray(s.misconceptions)
      ? (s.misconceptions as unknown as { answer: string; ru: string; kk: string }[]).map(pattern => ({ ...pattern,
        skillId: s.skills?.length === 1 ? s.skills[0].skillId : q.skills?.length === 1 ? q.skills[0].skillId : undefined })) : []);
    const mapping = [...patterns, ...(authored?.correct === q.correctAnswer ? [authored] : [])]
      .find(p => validateExpressionOffline(p.answer, text).isEquivalent);
    if (index && mapping) Object.assign(options[index], { misconception: { errorType: "incorrect_method", ...mapping,
      skillId: mapping.skillId } });
  }
  const general = !!antiderivatives[q.id];
  const formula = legacyFormula[q.id];
  const hint = hints[q.topicId ?? ""] ?? defaultHint;
  const inlineStem = (text?: string | null) => {
    return text ? choiceStem(text) : text;
  };
  return choiceSchema.parse({ version: 1, type: "single", options, correctOptionIds: [options[0].id],
    questionText: formula ? `${formula[0]}: $${choiceLatex(formula[2])}$${general ? ". C — произвольная константа." : ""}` : q.id === "q3_t1" ? `${q.questionText}, x > 0` : q.id === "q3_t2" ? `${q.questionText}, x ≠ 2` :
      general ? `${q.questionText}. Выберите общий вид всех первообразных (C — произвольная константа).` : inlineStem(q.questionText),
    questionTextKk: formula ? `${formula[1]}: $${choiceLatex(formula[2])}$${general ? ". C — еркін тұрақты." : ""}` : q.id === "q3_t1" ? `${q.questionTextKk}, x > 0` : q.id === "q3_t2" ? `${q.questionTextKk}, x ≠ 2` :
      general ? `${q.questionTextKk}. Барлық алғашқы функциялардың жалпы түрін таңдаңыз (C — еркін тұрақты).` : inlineStem(q.questionTextKk),
    latex: q.latex ?? null, explanation: general ? `${q.explanation} Все первообразные: ${correct}.` : q.explanation,
    explanationKk: general ? `${q.explanationKk} Барлық алғашқы функциялар: ${correct}.` : q.explanationKk,
    skillIds: [...new Set([...(q.skills ?? []).map(s => s.skillId), ...q.steps.flatMap(s => (s.skills ?? []).map(v => v.skillId))])],
    hint: { ru: hint[0], kk: hint[1] },
    solutionSteps: q.steps.map((s,index) => ({ prompt: s.prompt, promptKk: s.promptKk,
      answer: index === q.steps.length - 1 && (general || q.id === "q3_t11") ? correct : s.expectedAnswer })),
  });
}
