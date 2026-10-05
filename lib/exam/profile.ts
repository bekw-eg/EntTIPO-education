export type DifficultyBand = "A" | "B" | "C";
export type MatchQuality = "direct" | "supporting" | "outside" | "needs_review";
export interface ExamPoint {
  code: string; section: string; title: string; skills: string[]; topicId: string; page: number;
}
export interface ExamProfile {
  id: string; version: string; title: string; documentYear: number; checkedAt: string;
  audience: string; applicability: string; sources: { id: string; title: string; url: string; locator: string; sha256?: string; hashTarget?: string; snapshotUrl?: string }[];
  official: {
    questionCount: number; format: "single_choice_4"; difficultyCounts: Record<DifficultyBand, number>;
    correctPoints: number; incorrectPoints: number; maxPoints: number;
    wholeExamMinutes: number; mathBlockMinutes: number | null; averageTaskMinutes: [number, number];
    topicQuotas: null;
  };
  platformPolicy: { minFamiliesPerPoint: number; requestedVariants: number; description: string };
  points: ExamPoint[];
}

const rows: [string, string, string, string, string][] = [
  ["01", "01. Функция, свойства и график", "Дробно-линейная функция", "rational_graph", "t15"],
  ["02", "02. Тригонометрические функции", "Уравнения с обратными тригонометрическими функциями", "inverse_trig_equations", "t12"],
  ["03", "02. Тригонометрические функции", "Простейшие тригонометрические уравнения", "trig_equations", "t11"],
  ["04", "02. Тригонометрические функции", "Тригонометрические неравенства", "trig_inequalities", "t11"],
  ["05", "03. Многочлены", "Многочлены нескольких переменных; стандартный вид, однородность и симметрия", "multivariable_polynomials", "t2"],
  ["06", "04. Степени, корни, степенная функция", "Корень n-й степени и свойства", "nth_roots", "t1"],
  ["07", "04. Степени, корни, степенная функция", "Преобразование иррациональных выражений", "irrational_transformations", "t1"],
  ["08", "05. Показательная и логарифмическая функции", "Показательная функция: свойства и график", "exponential_graph", "t10"],
  ["09", "05. Показательная и логарифмическая функции", "Логарифмическая функция: свойства и график в зависимости от основания", "logarithmic_graph", "t9"],
  ["10", "06. Производная и применение", "Определение, правила производной, степень с действительным показателем", "derivative_rules", "t4"],
  ["11", "06. Производная и применение", "Уравнение касательной к графику", "tangent_equation", "t5"],
  ["12", "07. Первообразная и интеграл", "Первообразная, неопределённый интеграл и его свойства", "indefinite_integral", "t6"],
  ["13", "07. Первообразная и интеграл", "Интеграл степенной и показательной функций", "power_exponential_integral", "t7"],
  ["14", "08. Комплексные числа", "Мнимые и комплексные числа, действия с ними", "complex_operations", "t3"],
  ["15", "09. Дифференциальные уравнения", "Первый порядок: разделяющиеся переменные", "separable_ode", "t13"],
  ["16", "09. Дифференциальные уравнения", "Линейные однородные ДУ второго порядка с постоянными коэффициентами", "linear_ode", "t14"],
  ["17", "10. Тела вращения и элементы", "Цилиндр: элементы, развёртка, боковая и полная поверхность", "cylinder_surface", "exam_surfaces"],
  ["18", "10. Тела вращения и элементы", "Конус: элементы, развёртка, боковая и полная поверхность", "cone_surface", "exam_surfaces"],
  ["19", "11. Объёмы тел", "Объёмы призмы, пирамиды и усечённой пирамиды", "polyhedron_volume", "exam_volumes"],
  ["20", "11. Объёмы тел", "Объёмы цилиндра, конуса и усечённого конуса", "rotation_volume", "exam_volumes"],
];

export const TIPO_MATH: ExamProfile = {
  id: "ntc-tipo-b057-math-2023", version: "1.0.0", documentYear: 2023, checkedAt: "2026-10-04",
  title: "Математика естественно-математического направления — ЕНТ для сокращённых сроков обучения (с 2023 года)",
  audience: "Выпускники ТиПО/ТжКБ по Software Development / 06130100 «Программное обеспечение», поступающие на родственное направление B057 «Информационные технологии» с сокращённым сроком обучения.",
  applicability: "На дату проверки этот документ размещён НЦТ в пакете B057. Год документа — 2023; отдельная редакция 2026 не обнаружена. Профиль не распространяется автоматически на полный срок обучения или другую ГОП.",
  sources: [
    { id: "preparation", title: "НЦТ: подготовка к ЕНТ ТиПО", url: "https://testcenter.kz/?page_id=16208&lang=ru", locator: "B057 — Информационные технологии" },
    { id: "specification", title: "НЦТ: пакет B057, Математика.pdf", url: "https://testcenter.kz/wp-content/uploads/2024/12/В057_Информационные%20технологии.rar", locator: "Математика.pdf: стр. 1–2 — содержание; стр. 3 — пункты 4–8", sha256: "c8f2084cdce0788678178f8e0a05c91cb43a64d58e010589282bde4bb22284f7", hashTarget: "Извлечённый оригинал Математика.pdf", snapshotUrl: "/exam-sources/ntc-b057-math-2023.pdf" },
    { id: "related", title: "НЦТ: родственные направления", url: "https://testcenter.kz/wp-content/uploads/2025/06/Родс-русс.zip", locator: "Приложение рус_compressed.pdf: PDF-стр. 208–210 (печатные 209–211), B057, 06130100, 4S06130103", sha256: "3f18f9ae1dbd4e63f136c8f09d1859aad86895e096fb51e25d9279016814b0aa", hashTarget: "Архив Родс-русс.zip" },
    { id: "subjects", title: "НЦТ: общепрофессиональная и специальная дисциплины", url: "https://testcenter.kz/?page_id=15562&lang=ru", locator: "Перечень ГОП (PDF, ноябрь 2025), стр. 3: B057 — Математика / Основы алгоритмизации и программирования" },
    { id: "format", title: "НЦТ: формат сокращённого ЕНТ", url: "https://testcenter.kz/?page_id=16204&lang=ru", locator: "Общепрофессиональная дисциплина: 20 заданий, один из четырёх ответов; весь экзамен: 60 заданий, 70 баллов, 120 минут" },
    { id: "rules", title: "Правила ЕНТ, приказ №204 от 02.05.2017 (действующая опубликованная редакция)", url: "https://old.adilet.zan.kz/rus/docs/V1700015173", locator: "п. 19(1) — 1/0 балл; п. 79 — время; п. 85 — применение п. 19 в электронном формате" },
  ],
  official: { questionCount: 20, format: "single_choice_4", difficultyCounts: { A: 5, B: 10, C: 5 },
    correctPoints: 1, incorrectPoints: 0, maxPoints: 20, wholeExamMinutes: 120, mathBlockMinutes: null,
    averageTaskMinutes: [1.5, 2], topicQuotas: null },
  platformPolicy: { minFamiliesPerPoint: 3, requestedVariants: 3,
    description: "Внутренний аудит требует минимум три разных способа решения на пункт. Проверка сбалансированного варианта требует по одному заданию на каждый пункт; это настройка платформы, а не квота НЦТ. Семейство решения не повторяется между проверяемыми вариантами." },
  points: rows.map(([code, section, title, skill, topicId]) => ({ code, section, title, skills: [`exam_${skill}`], topicId, page: Number(code) <= 6 ? 1 : 2 })),
};

export const EXAM_PROFILES: ExamProfile[] = [TIPO_MATH];
export function getExamProfile(id: string) { return EXAM_PROFILES.find((p) => p.id === id); }

export function validateExamProfile(profile: ExamProfile) {
  if (!profile.id || !profile.version || !profile.sources.length || !/^\d{4}-\d{2}-\d{2}$/.test(profile.checkedAt)) throw new Error("Incomplete exam profile");
  if (new Set(profile.points.map((p) => p.code)).size !== profile.points.length || profile.points.some((p) => !p.skills.length || !p.section || !p.title)) throw new Error("Invalid specification points");
  if (Object.values(profile.official.difficultyCounts).some((n) => !Number.isInteger(n) || n < 0) ||
    Object.values(profile.official.difficultyCounts).reduce((a, b) => a + b, 0) !== profile.official.questionCount) throw new Error("Difficulty quotas do not sum to question count");
}
