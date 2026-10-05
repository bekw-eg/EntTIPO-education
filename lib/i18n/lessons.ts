import { Locale } from "./types";

export interface LessonContent {
  title: string;
  description: string;
  whatIsIt: string;
  whenUsed: string;
  formulaLatex: string;
  formula: string;
  example: string;
  commonErrors: string;
}

export const topicLessons: Record<string, Record<Locale, LessonContent>> = {
  t1: {
    ru: {
      title: "Корни и степени",
      description: "Свойства степеней с рациональными показателями и арифметических корней.",
      whatIsIt: "Степень показывает многократное умножение числа на себя. Арифметический корень n-й степени из неотрицательного числа a — это такое неотрицательное число, n-я степень которого равна a.",
      whenUsed: "Встречается в ЕНТ в заданиях на упрощение выражений, нахождение области допустимых значений (ОДЗ) и решение иррациональных уравнений.",
      formulaLatex: "a^n \\cdot a^m = a^{n+m}, \\quad a^{\\frac{1}{n}} = \\sqrt[n]{a}, \\quad (a^n)^m = a^{n \\cdot m}",
      formula: "a^n * a^m = a^(n+m), a^(1/n) = sqrt[n](a)",
      example: "2^3 = 8\n\\sqrt{9} = 3\n27^{2/3} = (\\sqrt[3]{27})^2 = 3^2 = 9",
      commonErrors: "1. Путают умножение и сложение показателей: (a^n)^m = a^{n·m}, а не a^{n+m}.\n2. Забывают, что под корнем четной степени выражение должно быть >= 0 (ОДЗ)."
    },
    kk: {
      title: "Түбірлер мен дәрежелер",
      description: "Рационал көрсеткішті дәрежелер мен арифметикалық түбірлердің қасиеттері.",
      whatIsIt: "Дәреже — санның өзіне-өзі бірнеше рет көбейтілуін көрсетеді. Теріс емес a санынан алынған n-ші дәрежелі арифметикалық түбір — n-ші дәрежесі a-ға тең теріс емес сан.",
      whenUsed: "ҰБТ-да өрнектерді ықшамдау, анықталу облысын (ММЖ) табу және иррационал теңдеулерді шешу тапсырмаларында қолданылады.",
      formulaLatex: "a^n \\cdot a^m = a^{n+m}, \\quad a^{\\frac{1}{n}} = \\sqrt[n]{a}, \\quad (a^n)^m = a^{n \\cdot m}",
      formula: "a^n * a^m = a^(n+m), a^(1/n) = sqrt[n](a)",
      example: "2^3 = 8\n\\sqrt{9} = 3\n27^{2/3} = (\\sqrt[3]{27})^2 = 3^2 = 9",
      commonErrors: "1. Көрсеткіштерді көбейту мен қосуды шатастыру: (a^n)^m = a^{n·m}, бірақ a^{n+m} емес.\n2. Жұп дәрежелі түбір астындағы өрнектің теріс болмау шартын (ММЖ) ұмытып кету."
    },
    en: {
      title: "Roots and Powers",
      description: "Properties of powers with rational exponents and arithmetic roots.",
      whatIsIt: "A power indicates repeated multiplication of a base by itself. The n-th root of a non-negative number a is the unique non-negative number whose n-th power equals a.",
      whenUsed: "Essential for algebraic simplification, domain validation (ODZ), and solving radical equations in ENT exams.",
      formulaLatex: "a^n \\cdot a^m = a^{n+m}, \\quad a^{\\frac{1}{n}} = \\sqrt[n]{a}, \\quad (a^n)^m = a^{n \\cdot m}",
      formula: "a^n * a^m = a^(n+m), a^(1/n) = sqrt[n](a)",
      example: "2^3 = 8\n\\sqrt{9} = 3\n27^{2/3} = (\\sqrt[3]{27})^2 = 3^2 = 9",
      commonErrors: "1. Confusing multiplication and addition of exponents: (a^n)^m = a^{n·m}, not a^{n+m}.\n2. Forgetting that even-degree radicands must be non-negative (domain constraint)."
    }
  },

  t2: {
    ru: {
      title: "Многочлены",
      description: "Действия с многочленами, формулы сокращенного умножения и разложение на множители.",
      whatIsIt: "Многочлен — это алгебраическая сумма одночленов. Разложение на множители позволяет упрощать дроби и находить корни уравнений.",
      whenUsed: "Базовый навык для решения квадратных и кубических уравнений, сокращения рациональных дробей.",
      formulaLatex: "(a \\pm b)^2 = a^2 \\pm 2ab + b^2, \\quad a^2 - b^2 = (a-b)(a+b)",
      formula: "(a+b)^2 = a^2 + 2ab + b^2, a^2 - b^2 = (a-b)(a+b)",
      example: "x^2 - 5x + 6 = (x-2)(x-3)\n(2x + 3)^2 = 4x^2 + 12x + 9",
      commonErrors: "1. Забывают удвоенное произведение 2ab: пишут (a+b)^2 = a^2 + b^2.\n2. Ошибки в знаках при раскрытии скобок со знаком минус."
    },
    kk: {
      title: "Көпмүшелер",
      description: "Көпмүшелерге амалдар қолдану, қысқаша көбейту формулалары және көбейткіштерге жіктеу.",
      whatIsIt: "Көпмүше — бірмүшелердің алгебралық қосындысы. Көбейткіштерге жіктеу бөлшектерді қысқартуға және теңдеулердің түбірлерін табуға көмектеседі.",
      whenUsed: "Квадраттық және кубтық теңдеулерді шешуде, бөлшектерді ықшамдауда қолданылады.",
      formulaLatex: "(a \\pm b)^2 = a^2 \\pm 2ab + b^2, \\quad a^2 - b^2 = (a-b)(a+b)",
      formula: "(a+b)^2 = a^2 + 2ab + b^2, a^2 - b^2 = (a-b)(a+b)",
      example: "x^2 - 5x + 6 = (x-2)(x-3)\n(2x + 3)^2 = 4x^2 + 12x + 9",
      commonErrors: "1. Екі еселенген көбейтіндіні 2ab ұмыту: (a+b)^2 = a^2 + b^2 деп қате жазу.\n2. Жақша алдындағы минус таңбасы бар кезде таңбаларды ауыстыруды ұмыту."
    },
    en: {
      title: "Polynomials",
      description: "Polynomial operations, binomial expansion, and factoring techniques.",
      whatIsIt: "A polynomial is an algebraic expression consisting of variables and coefficients. Factoring simplifies expressions and finds roots.",
      whenUsed: "Fundamental for solving quadratic and higher-degree equations and simplifying rational fractions.",
      formulaLatex: "(a \\pm b)^2 = a^2 \\pm 2ab + b^2, \\quad a^2 - b^2 = (a-b)(a+b)",
      formula: "(a+b)^2 = a^2 + 2ab + b^2, a^2 - b^2 = (a-b)(a+b)",
      example: "x^2 - 5x + 6 = (x-2)(x-3)\n(2x + 3)^2 = 4x^2 + 12x + 9",
      commonErrors: "1. Omitting the cross-term 2ab: writing (a+b)^2 = a^2 + b^2.\n2. Sign distribution errors when expanding negative parenthesized terms."
    }
  },

  t3: {
    ru: {
      title: "Комплексные числа",
      description: "Числа вида a + bi, мнимая единица, модуль и сопряженные числа.",
      whatIsIt: "Расширение действительных чисел с мнимой единицей i, где i^2 = -1. Любое комплексное число записывается как z = a + bi.",
      whenUsed: "Решение квадратных уравнений с отрицательным дискриминантом, электротехника и высшая математика.",
      formulaLatex: "z = a + bi, \\quad i^2 = -1, \\quad |z| = \\sqrt{a^2 + b^2}, \\quad (a+bi)(a-bi) = a^2 + b^2",
      formula: "z = a + bi, i^2 = -1, |z| = sqrt(a^2 + b^2)",
      example: "(2 + 3i)(2 - 3i) = 2^2 + 3^2 = 4 + 9 = 13\n|3 + 4i| = \\sqrt{3^2 + 4^2} = 5",
      commonErrors: "1. Забывают, что i^2 = -1, и пишут i^2 = 1.\n2. В формуле модуля пишут a^2 - b^2 вместо a^2 + b^2."
    },
    kk: {
      title: "Комплекс сандар",
      description: "a + bi түріндегі сандар, жорамал бірлік, модуль және түйіндес сандар.",
      whatIsIt: "Жорамал бірлік i (мұндағы i^2 = -1) арқылы нақты сандарды кеңейту. Кез келген комплекс сан z = a + bi түрінде жазылады.",
      whenUsed: "Дискриминанты теріс квадрат теңдеулерді шешуде, электротехника мен жоғары математикада қолданылады.",
      formulaLatex: "z = a + bi, \\quad i^2 = -1, \\quad |z| = \\sqrt{a^2 + b^2}, \\quad (a+bi)(a-bi) = a^2 + b^2",
      formula: "z = a + bi, i^2 = -1, |z| = sqrt(a^2 + b^2)",
      example: "(2 + 3i)(2 - 3i) = 2^2 + 3^2 = 4 + 9 = 13\n|3 + 4i| = \\sqrt{3^2 + 4^2} = 5",
      commonErrors: "1. i^2 = -1 екенін ұмытып, i^2 = 1 деп есептеу.\n2. Модуль формуласында a^2 + b^2 орнына a^2 - b^2 деп шатастыру."
    },
    en: {
      title: "Complex Numbers",
      description: "Numbers of the form a + bi, imaginary unit, absolute value, and complex conjugates.",
      whatIsIt: "An extension of real numbers incorporating the imaginary unit i, where i^2 = -1. Every complex number is expressed as z = a + bi.",
      whenUsed: "Used for solving equations with negative discriminants, signal processing, and engineering mathematics.",
      formulaLatex: "z = a + bi, \\quad i^2 = -1, \\quad |z| = \\sqrt{a^2 + b^2}, \\quad (a+bi)(a-bi) = a^2 + b^2",
      formula: "z = a + bi, i^2 = -1, |z| = sqrt(a^2 + b^2)",
      example: "(2 + 3i)(2 - 3i) = 2^2 + 3^2 = 4 + 9 = 13\n|3 + 4i| = \\sqrt{3^2 + 4^2} = 5",
      commonErrors: "1. Forgetting that i^2 = -1 (often incorrectly assuming i^2 = 1).\n2. Using subtraction instead of addition inside the modulus formula."
    }
  },

  t4: {
    ru: {
      title: "Производная",
      description: "Таблица производных, правила дифференцирования и производная сложной функции.",
      whatIsIt: "Производная функции f'(x) характеризует мгновенную скорость изменения функции в заданной точке x.",
      whenUsed: "Нахождение экстремумов (максимумов и минимумов), промежутков возрастания/убывания и в физических задачах.",
      formulaLatex: "(x^n)' = n x^{n-1}, \\quad (uv)' = u'v + uv', \\quad \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}",
      formula: "(x^n)' = n*x^(n-1), (u*v)' = u'*v + u*v'",
      example: "f(x) = x^3 + 2x^2 - 5x + 1 \\implies f'(x) = 3x^2 + 4x - 5\n(\\sin(x) \\cdot e^x)' = \\cos(x)e^x + \\sin(x)e^x",
      commonErrors: "1. Ошибки в правиле частного (путают порядок вычитания в числителе).\n2. Забывают умножить на производную внутренней функции в сложной функции."
    },
    kk: {
      title: "Туынды",
      description: "Туындылар кестесі, дифференциалдау ережелері және күрделі функция туындысы.",
      whatIsIt: "f'(x) функциясының туындысы берілген x нүктесіндегі функцияның лездік өзгеру жылдамдығын сипаттайды.",
      whenUsed: "Функцияның өсу/кему аралықтарын, экстремумдарын (максимум/минимум) табу және физикалық есептерде.",
      formulaLatex: "(x^n)' = n x^{n-1}, \\quad (uv)' = u'v + uv', \\quad \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}",
      formula: "(x^n)' = n*x^(n-1), (u*v)' = u'*v + u*v'",
      example: "f(x) = x^3 + 2x^2 - 5x + 1 \\implies f'(x) = 3x^2 + 4x - 5\n(\\sin(x) \\cdot e^x)' = \\cos(x)e^x + \\sin(x)e^x",
      commonErrors: "1. Бөліндінің туындысында алымындағы таңбаларды шатастыру: u'v - uv'.\n2. Күрделі функцияны дифференциалдағанда ішкі функцияның туындысына көбейтуді ұмыту."
    },
    en: {
      title: "Derivative",
      description: "Standard derivatives table, differentiation rules, and the chain rule.",
      whatIsIt: "The derivative f'(x) measures the instantaneous rate of change of a function with respect to its variable.",
      whenUsed: "Used to determine local extrema, monotonicity intervals, inflection points, and rates of change in physics.",
      formulaLatex: "(x^n)' = n x^{n-1}, \\quad (uv)' = u'v + uv', \\quad \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}",
      formula: "(x^n)' = n*x^(n-1), (u*v)' = u'*v + u*v'",
      example: "f(x) = x^3 + 2x^2 - 5x + 1 \\implies f'(x) = 3x^2 + 4x - 5\n(\\sin(x) \\cdot e^x)' = \\cos(x)e^x + \\sin(x)e^x",
      commonErrors: "1. Misplacing terms in the quotient rule numerator.\n2. Neglecting the inner derivative when applying the chain rule."
    }
  },

  t5: {
    ru: {
      title: "Касательная к графику",
      description: "Геометрический смысл производной и составление уравнения касательной.",
      whatIsIt: "Касательная к графику функции в точке x_0 — это прямая, угловой коэффициент k которой равен значению производной f'(x_0).",
      whenUsed: "В задачах ЕНТ на составление уравнения касательной и нахождение точек, где касательная параллельна заданной прямой.",
      formulaLatex: "y = f(x_0) + f'(x_0)(x - x_0), \\quad k = \\tan(\\alpha) = f'(x_0)",
      formula: "y = f(x0) + f'(x0)*(x - x0)",
      example: "Для $f(x) = x^2$ в точке $x_0 = 2$:\n$f(2) = 4, \\quad f'(x) = 2x \\implies f'(2) = 4$\n$y = 4 + 4(x - 2) = 4x - 4$",
      commonErrors: "1. Путают значение функции f(x_0) со значением производной f'(x_0).\n2. Забывают раскрыть скобки (x - x_0) с учетом знака x_0."
    },
    kk: {
      title: "Графикке жанама",
      description: "Туындының геометриялық мағынасы және жанаманың теңдеуін құру.",
      whatIsIt: "x_0 нүктесіндегі f(x) графигіне жанама — бұрыштық коэффициенті k = f'(x_0) туындысына тең түзу сызық.",
      whenUsed: "ҰБТ-да жанаманың теңдеуін жазу және берілген түзуге параллель жанаманың жанасу нүктесін табу есептерінде.",
      formulaLatex: "y = f(x_0) + f'(x_0)(x - x_0), \\quad k = \\tan(\\alpha) = f'(x_0)",
      formula: "y = f(x0) + f'(x0)*(x - x0)",
      example: "$f(x) = x^2$ үшін $x_0 = 2$ нүктесінде:\n$f(2) = 4, \\quad f'(x) = 2x \\implies f'(2) = 4$\n$y = 4 + 4(x - 2) = 4x - 4$",
      commonErrors: "1. Функция мәні f(x_0) мен туынды мәнін f'(x_0) шатастыру.\n2. (x - x_0) жақшасын ашқанда x_0 таңбасын ескермеу."
    },
    en: {
      title: "Tangent to Graph",
      description: "Geometric interpretation of the derivative and tangent line equation.",
      whatIsIt: "The tangent line to the graph of y = f(x) at x_0 is a line whose slope k is equal to the derivative evaluated at that point, f'(x_0).",
      whenUsed: "Standard ENT questions on writing tangent equations and finding points where tangents are parallel to given lines.",
      formulaLatex: "y = f(x_0) + f'(x_0)(x - x_0), \\quad k = \\tan(\\alpha) = f'(x_0)",
      formula: "y = f(x0) + f'(x0)*(x - x0)",
      example: "For $f(x) = x^2$ at $x_0 = 2$:\n$f(2) = 4, \\quad f'(x) = 2x \\implies f'(2) = 4$\n$y = 4 + 4(x - 2) = 4x - 4$",
      commonErrors: "1. Swapping f(x_0) and f'(x_0).\n2. Calculation errors when distributing slope over (x - x_0)."
    }
  },

  t6: {
    ru: {
      title: "Первообразная",
      description: "Понятие первообразной, правила нахождения и неопределенный интеграл.",
      whatIsIt: "Первообразная F(x) для функции f(x) — это функция, производная которой равна f(x), то есть F'(x) = f(x). Множество всех первообразных записывается как F(x) + C.",
      whenUsed: "Фундамент для вычисления интегралов, площадей криволинейных трапеций и восстановления закона движения по скорости.",
      formulaLatex: "\\int x^n dx = \\frac{x^{n+1}}{n+1} + C \\quad (n \\neq -1), \\quad \\int \\frac{1}{x} dx = \\ln|x| + C",
      formula: "int x^n dx = x^(n+1)/(n+1) + C",
      example: "Для $f(x) = 3x^2 + 2x$:\n$F(x) = 3 \\cdot \\frac{x^3}{3} + 2 \\cdot \\frac{x^2}{2} + C = x^3 + x^2 + C$",
      commonErrors: "1. Забывают прибавить постоянную интегрирования C.\n2. Путают дифференцирование и интегрирование: уменьшают степень вместо увеличения."
    },
    kk: {
      title: "Алғашқы функция",
      description: "Алғашқы функция түсінігі, табу ережелері және анықталмаған интеграл.",
      whatIsIt: "f(x) үшін F(x) алғашқы функциясы — туындысы f(x)-ке тең болатын функция, яғни F'(x) = f(x). Барлық алғашқы функциялар жиынтығы F(x) + C түрінде болады.",
      whenUsed: "Интегралдарды, қисықсызықты трапецияның ауданын есептеу және жылдамдық бойынша қозғалыс заңын анықтау үшін.",
      formulaLatex: "\\int x^n dx = \\frac{x^{n+1}}{n+1} + C \\quad (n \\neq -1), \\quad \\int \\frac{1}{x} dx = \\ln|x| + C",
      formula: "int x^n dx = x^(n+1)/(n+1) + C",
      example: "$f(x) = 3x^2 + 2x$ үшін:\n$F(x) = 3 \\cdot \\frac{x^3}{3} + 2 \\cdot \\frac{x^2}{2} + C = x^3 + x^2 + C$",
      commonErrors: "1. Интегралдау тұрақтысы C-ны қосуды ұмытып кету.\n2. Интегралдау кезінде дәрежені арттырудың орнына азайтып қою."
    },
    en: {
      title: "Antiderivative",
      description: "Definition of antiderivatives, indefinite integration rules, and integration constant.",
      whatIsIt: "An antiderivative F(x) of f(x) is a function whose derivative is f(x), i.e., F'(x) = f(x). The family of all antiderivatives is written as F(x) + C.",
      whenUsed: "Core foundation for evaluating definite integrals, calculating planar areas, and physics kinematics.",
      formulaLatex: "\\int x^n dx = \\frac{x^{n+1}}{n+1} + C \\quad (n \\neq -1), \\quad \\int \\frac{1}{x} dx = \\ln|x| + C",
      formula: "int x^n dx = x^(n+1)/(n+1) + C",
      example: "For $f(x) = 3x^2 + 2x$:\n$F(x) = 3 \\cdot \\frac{x^3}{3} + 2 \\cdot \\frac{x^2}{2} + C = x^3 + x^2 + C$",
      commonErrors: "1. Omitting the arbitrary constant of integration + C.\n2. Decreasing the exponent instead of increasing it (confusing with differentiation)."
    }
  },

  t7: {
    ru: {
      title: "Интегралы",
      description: "Определенный интеграл, формула Ньютона-Лейбница и вычисление площадей.",
      whatIsIt: "Определенный интеграл от a до b равен приращению любой первообразной F(b) - F(a). Геометрически он равен ориентированной площади под графиком функции.",
      whenUsed: "Нахождение площадей фигур, объемов тел вращения и расчет пути в физических процессах.",
      formulaLatex: "\\int_a^b f(x) dx = F(b) - F(a) = \\left. F(x) \\right|_a^b",
      formula: "int_a^b f(x) dx = F(b) - F(a)",
      example: "\\int_0^2 x^2 dx = \\left. \\frac{x^3}{3} \\right|_0^2 = \\frac{2^3}{3} - \\frac{0^3}{3} = \\frac{8}{3}",
      commonErrors: "1. Путают порядок подстановки пределов: нужно вычитать F(a) из F(b), а не наоборот.\n2. Ошибки в знаках при подстановке отрицательных пределов интегрирования."
    },
    kk: {
      title: "Интегралдар",
      description: "Анықталған интеграл, Ньютон-Лейбниц формуласы және аудандарды есептеу.",
      whatIsIt: "a-дан b-ға дейінгі анықталған интеграл кез келген алғашқы функцияның F(b) - F(a) өсімшесіне тең. Геометриялық мағынасы — график астындағы аудан.",
      whenUsed: "Фигуралардың ауданын, айналу денелерінің көлемін және жүрілген жолды есептеуде қолданылады.",
      formulaLatex: "\\int_a^b f(x) dx = F(b) - F(a) = \\left. F(x) \\right|_a^b",
      formula: "int_a^b f(x) dx = F(b) - F(a)",
      example: "\\int_0^2 x^2 dx = \\left. \\frac{x^3}{3} \\right|_0^2 = \\frac{2^3}{3} - \\frac{0^3}{3} = \\frac{8}{3}",
      commonErrors: "1. Шекараларды қою ретін шатастыру: F(b) - F(a) ережесін қатаң сақтау керек.\n2. Төменгі шек теріс сан болған кезде таңбалардан қателесу."
    },
    en: {
      title: "Integrals",
      description: "Definite integrals, the Fundamental Theorem of Calculus (Newton-Leibniz formula), and area calculations.",
      whatIsIt: "The definite integral from a to b measures the net accumulated value, computed as F(b) - F(a). Geometrically, it represents the signed area under the curve.",
      whenUsed: "Used in ENT for calculating geometric area between curves, volumes of solids, and kinematics problems.",
      formulaLatex: "\\int_a^b f(x) dx = F(b) - F(a) = \\left. F(x) \\right|_a^b",
      formula: "int_a^b f(x) dx = F(b) - F(a)",
      example: "\\int_0^2 x^2 dx = \\left. \\frac{x^3}{3} \\right|_0^2 = \\frac{2^3}{3} - \\frac{0^3}{3} = \\frac{8}{3}",
      commonErrors: "1. Reversing the limit evaluation order (evaluating F(a) - F(b)).\n2. Double negative sign errors when lower limit a is negative."
    }
  },

  t8: {
    ru: {
      title: "Экспоненциальные интегралы",
      description: "Интегрирование экспоненциальных функций и метод интегрирования по частям.",
      whatIsIt: "Интегралы, содержащие показательные выражения вида e^{kx} или произведения вида x^n e^x, решаемые формулой подведения под знак дифференциала или интегрированием по частям.",
      whenUsed: "Модели радиоактивного распада, экономические процессы с непрерывным начислением процентов, задачи повышенной сложности ЕНТ.",
      formulaLatex: "\\int e^{kx} dx = \\frac{1}{k} e^{kx} + C, \\quad \\int u \\, dv = u v - \\int v \\, du",
      formula: "int e^(kx) dx = (1/k)*e^(kx) + C, int u dv = u*v - int v du",
      example: "\\int x e^x dx: \\quad u=x, dv=e^x dx \\implies v=e^x, du=dx\n\\int x e^x dx = x e^x - \\int e^x dx = e^x(x - 1) + C",
      commonErrors: "1. Забывают делить на коэффициент k перед x: \\int e^{2x} dx = \\frac{1}{2} e^{2x} + C (а не 2e^{2x}).\n2. Неправильный выбор u и dv при интегрировании по частям."
    },
    kk: {
      title: "Көрсеткіштік интегралдар",
      description: "Көрсеткіштік функцияларды интегралдау және бөліктеп интегралдау әдісі.",
      whatIsIt: "e^{kx} түріндегі көрсеткіштік өрнектер мен x^n e^x түріндегі көбейтінділерді интегралдау әдістері (дифференциал таңбасы астына енгізу немесе бөліктеп интегралдау).",
      whenUsed: "Радиоактивті ыдырау, үздіксіз пайыздық өсу үлгілерінде және ҰБТ-ның күрделі сұрақтарында.",
      formulaLatex: "\\int e^{kx} dx = \\frac{1}{k} e^{kx} + C, \\quad \\int u \\, dv = u v - \\int v \\, du",
      formula: "int e^(kx) dx = (1/k)*e^(kx) + C, int u dv = u*v - int v du",
      example: "\\int x e^x dx: \\quad u=x, dv=e^x dx \\implies v=e^x, du=dx\n\\int x e^x dx = x e^x - \\int e^x dx = e^x(x - 1) + C",
      commonErrors: "1. x алдындағы k коэффициентіне бөлуді ұмыту: \\int e^{2x} dx = \\frac{1}{2}e^{2x} + C.\n2. Бөліктеп интегралдағанда u және dv айнымалыларын дұрыс таңдамау."
    },
    en: {
      title: "Exponential Integrals",
      description: "Integration of exponential expressions and integration by parts.",
      whatIsIt: "Integrals involving e^{kx} and products like x^n e^x, evaluated via substitution or the integration by parts formula.",
      whenUsed: "Common in ENT advanced sections, differential rate models, and continuous growth calculations.",
      formulaLatex: "\\int e^{kx} dx = \\frac{1}{k} e^{kx} + C, \\quad \\int u \\, dv = u v - \\int v \\, du",
      formula: "int e^(kx) dx = (1/k)*e^(kx) + C, int u dv = u*v - int v du",
      example: "\\int x e^x dx: \\quad u=x, dv=e^x dx \\implies v=e^x, du=dx\n\\int x e^x dx = x e^x - \\int e^x dx = e^x(x - 1) + C",
      commonErrors: "1. Multiplying by k instead of dividing by k: \\int e^{kx} dx = \\frac{1}{k}e^{kx} + C.\n2. Poor selection of u and dv causing infinite loops in integration by parts."
    }
  },

  t9: {
    ru: {
      title: "Логарифмические функции",
      description: "Свойства логарифмов, натуральные и десятичные логарифмы, логарифмические уравнения.",
      whatIsIt: "Логарифм \\log_a(b) — это показатель степени, в которую нужно возвести основание a, чтобы получить число b (где a > 0, a \\neq 1, b > 0).",
      whenUsed: "Решение уравнений и неравенств ЕНТ, логарифмирование степенных выражений.",
      formulaLatex: "\\log_a(x \\cdot y) = \\log_a(x) + \\log_a(y), \\quad \\log_a\\left(\\frac{x}{y}\\right) = \\log_a(x) - \\log_a(y), \\quad \\log_a(x^p) = p \\log_a(x)",
      formula: "log_a(b) = c <=> a^c = b, log_a(x*y) = log_a(x) + log_a(y)",
      example: "\\log_2(32) = 5 \\quad (\\text{так как } 2^5 = 32)\n\\log_3(x+2) = 2 \\implies x+2 = 3^2 = 9 \\implies x = 7",
      commonErrors: "1. Забывают про ОДЗ: аргумент логарифма должен быть строго положительным (b > 0).\n2. Ошибочно пишут \\log(x+y) = \\log(x) + \\log(y) (так делать нельзя!)."
    },
    kk: {
      title: "Логарифмдік функциялар",
      description: "Логарифмдердің қасиеттері, натурал және ондық логарифмдер, логарифмдік теңдеулер.",
      whatIsIt: "\\log_a(b) логарифмі — b санын алу үшін a негізін дәрежелейтін көрсеткіш (мұндағы a > 0, a \\neq 1, b > 0).",
      whenUsed: "ҰБТ-да логарифмдік теңдеулер мен теңсіздіктерді шешуде, күрделі өрнектерді ықшамдауда.",
      formulaLatex: "\\log_a(x \\cdot y) = \\log_a(x) + \\log_a(y), \\quad \\log_a\\left(\\frac{x}{y}\\right) = \\log_a(x) - \\log_a(y), \\quad \\log_a(x^p) = p \\log_a(x)",
      formula: "log_a(b) = c <=> a^c = b, log_a(x*y) = log_a(x) + log_a(y)",
      example: "\\log_2(32) = 5 \\quad (\\text{себебі } 2^5 = 32)\n\\log_3(x+2) = 2 \\implies x+2 = 3^2 = 9 \\implies x = 7",
      commonErrors: "1. ММЖ-ны (анықталу облысы) ұмыту: логарифм астындағы өрнек қатаң оң болуы керек (b > 0).\n2. \\log(x+y) = \\log(x) + \\log(y) деп қате қолдану (қосындының логарифмі жоқ)."
    },
    en: {
      title: "Logarithmic Functions",
      description: "Logarithm laws, natural and common logarithms, and logarithmic equations.",
      whatIsIt: "The logarithm \\log_a(b) is the exponent to which the base a must be raised to produce b (with a > 0, a \\neq 1, b > 0).",
      whenUsed: "Used in ENT to solve exponential and logarithmic equations and compute growth factors.",
      formulaLatex: "\\log_a(x \\cdot y) = \\log_a(x) + \\log_a(y), \\quad \\log_a\\left(\\frac{x}{y}\\right) = \\log_a(x) - \\log_a(y), \\quad \\log_a(x^p) = p \\log_a(x)",
      formula: "log_a(b) = c <=> a^c = b, log_a(x*y) = log_a(x) + log_a(y)",
      example: "\\log_2(32) = 5 \\quad (\\text{since } 2^5 = 32)\n\\log_3(x+2) = 2 \\implies x+2 = 3^2 = 9 \\implies x = 7",
      commonErrors: "1. Overlooking domain restrictions: the argument must be strictly positive (b > 0).\n2. Erroneously asserting that \\log(x+y) = \\log(x) + \\log(y)."
    }
  },

  t10: {
    ru: {
      title: "Показательные функции",
      description: "Свойства показательной функции, показательные уравнения и неравенства.",
      whatIsIt: "Функция вида f(x) = a^x (где a > 0, a \\neq 1). При a > 1 функция строго возрастает, при 0 < a < 1 — строго убывает.",
      whenUsed: "Задачи на показательные уравнения, вычисление сложных процентов, моделирование роста.",
      formulaLatex: "a^{f(x)} = a^{g(x)} \\iff f(x) = g(x), \\quad a^{f(x)} > a^{g(x)} \\iff \\begin{cases} f(x) > g(x), & a > 1 \\\\ f(x) < g(x), & 0 < a < 1 \\end{cases}",
      formula: "a^x = b <=> x = log_a(b)",
      example: "2^x = 32 \\implies 2^x = 2^5 \\implies x = 5\n3^{x+1} = 27 \\implies 3^{x+1} = 3^3 \\implies x+1 = 3 \\implies x = 2",
      commonErrors: "1. Не меняют знак неравенства при основании 0 < a < 1 (например, (1/2)^x > (1/2)^3 \\implies x < 3).\n2. Деление на переменную без проверки корней."
    },
    kk: {
      title: "Көрсеткіштік функциялар",
      description: "Көрсеткіштік функцияның қасиеттері, теңдеулері мен теңсіздіктері.",
      whatIsIt: "f(x) = a^x түріндегі функция (мұндағы a > 0, a \\neq 1). Егер a > 1 болса, функция өседі, ал 0 < a < 1 болса, кемиді.",
      whenUsed: "ҰБТ-да көрсеткіштік теңдеулер мен теңсіздіктерді шешуде, қарқынды өсу есептерінде.",
      formulaLatex: "a^{f(x)} = a^{g(x)} \\iff f(x) = g(x), \\quad a^{f(x)} > a^{g(x)} \\iff \\begin{cases} f(x) > g(x), & a > 1 \\\\ f(x) < g(x), & 0 < a < 1 \\end{cases}",
      formula: "a^x = b <=> x = log_a(b)",
      example: "2^x = 32 \\implies 2^x = 2^5 \\implies x = 5\n3^{x+1} = 27 \\implies 3^{x+1} = 3^3 \\implies x+1 = 3 \\implies x = 2",
      commonErrors: "1. 0 < a < 1 болғанда теңсіздік таңбасын кері ауыстыруды ұмытып кету.\n2. Бірдей негізге келтірмей көрсеткіштерді теңестіру."
    },
    en: {
      title: "Exponential Functions",
      description: "Properties of exponential functions, exponential equations and inequalities.",
      whatIsIt: "Functions of the form f(x) = a^x where a > 0 and a \\neq 1. Strictly increasing if a > 1 and strictly decreasing if 0 < a < 1.",
      whenUsed: "Frequent ENT topic in solving equations and exponential inequality boundary tests.",
      formulaLatex: "a^{f(x)} = a^{g(x)} \\iff f(x) = g(x), \\quad a^{f(x)} > a^{g(x)} \\iff \\begin{cases} f(x) > g(x), & a > 1 \\\\ f(x) < g(x), & 0 < a < 1 \\end{cases}",
      formula: "a^x = b <=> x = log_a(b)",
      example: "2^x = 32 \\implies 2^x = 2^5 \\implies x = 5\n3^{x+1} = 27 \\implies 3^{x+1} = 3^3 \\implies x+1 = 3 \\implies x = 2",
      commonErrors: "1. Forgetting to reverse inequality signs when the base is in (0, 1).\n2. Incorrect base reduction when bases differ."
    }
  },

  t11: {
    ru: {
      title: "Тригонометрия",
      description: "Тригонометрический круг, тождества, формулы двойного угла и решение уравнений.",
      whatIsIt: "Раздел математики, изучающий функции углов (синус, косинус, тангенс, котангенс) и их соотношения на единичной окружности.",
      whenUsed: "Геометрические задачи, физические колебания, стандартные тригонометрические уравнения ЕНТ.",
      formulaLatex: "\\sin^2(x) + \\cos^2(x) = 1, \\quad \\sin(2x) = 2\\sin(x)\\cos(x), \\quad \\cos(2x) = \\cos^2(x) - \\sin^2(x)",
      formula: "sin^2(x) + cos^2(x) = 1, sin(2x) = 2*sin(x)*cos(x)",
      example: "\\sin(30^\\circ) = \\frac{1}{2}, \\quad \\cos(60^\\circ) = \\frac{1}{2}, \\quad \\tan(45^\\circ) = 1\n\\sin^2(\\alpha) + \\cos^2(\\alpha) = 1",
      commonErrors: "1. Путают знаки тригонометрических функций по четвертям (например, косинус во 2-й четверти отрицателен).\n2. Забывают период + 2\\pi k или + \\pi k в ответах тригонометрических уравнений."
    },
    kk: {
      title: "Тригонометрия",
      description: "Тригонометриялық шеңбер, негізгі тепе-теңдіктер, қос бұрыш формулалары.",
      whatIsIt: "Бұрыштардың функциялары (синус, косинус, тангенс, котангенс) мен олардың бірлік шеңбердегі қатынастарын зерттейтін бөлім.",
      whenUsed: "Геометриялық есептерде, физикалық тербелістерде және ҰБТ-ның тригонометриялық теңдеулерінде.",
      formulaLatex: "\\sin^2(x) + \\cos^2(x) = 1, \\quad \\sin(2x) = 2\\sin(x)\\cos(x), \\quad \\cos(2x) = \\cos^2(x) - \\sin^2(x)",
      formula: "sin^2(x) + cos^2(x) = 1, sin(2x) = 2*sin(x)*cos(x)",
      example: "\\sin(30^\\circ) = \\frac{1}{2}, \\quad \\cos(60^\\circ) = \\frac{1}{2}, \\quad \\tan(45^\\circ) = 1\n\\sin^2(\\alpha) + \\cos^2(\\alpha) = 1",
      commonErrors: "1. Ширектер бойынша таңбаларды шатастыру (мысалы, 2-ші ширекте косинус теріс).\n2. Теңдеулердің шешімдерінде периодты (+ 2\\pi k немесе + \\pi k) ұмыту."
    },
    en: {
      title: "Trigonometry",
      description: "Unit circle definitions, fundamental identities, double-angle formulas, and equations.",
      whatIsIt: "The branch dealing with angular relations: sine, cosine, tangent, and cotangent defined on the unit circle.",
      whenUsed: "Universal in geometry problems, wave physics, and analytical algebra in ENT exams.",
      formulaLatex: "\\sin^2(x) + \\cos^2(x) = 1, \\quad \\sin(2x) = 2\\sin(x)\\cos(x), \\quad \\cos(2x) = \\cos^2(x) - \\sin^2(x)",
      formula: "sin^2(x) + cos^2(x) = 1, sin(2x) = 2*sin(x)*cos(x)",
      example: "\\sin(30^\\circ) = \\frac{1}{2}, \\quad \\cos(60^\\circ) = \\frac{1}{2}, \\quad \\tan(45^\\circ) = 1\n\\sin^2(\\alpha) + \\cos^2(\\alpha) = 1",
      commonErrors: "1. Quadrant sign errors (e.g., negative cosine in the second quadrant).\n2. Forgetting the periodicity term (+ 2\\pi k or + \\pi k) in solutions."
    }
  },

  t12: {
    ru: {
      title: "Обратные тригонометрические функции",
      description: "Арксинус, арккосинус, арктангенс, их области определения и главных значений.",
      whatIsIt: "Функции, обратные к тригонометрическим: \\arcsin(x) \\in [-\\pi/2, \\pi/2], \\arccos(x) \\in [0, \\pi], \\arctan(x) \\in (-\\pi/2, \\pi/2).",
      whenUsed: "Нахождение точных значений углов по тригонометрическим соотношениям и решение обратных задач.",
      formulaLatex: "\\arcsin(-x) = -\\arcsin(x), \\quad \\arccos(-x) = \\pi - \\arccos(x), \\quad \\arcsin(x) + \\arccos(x) = \\frac{\\pi}{2}",
      formula: "arcsin(1/2) = pi/6, arccos(-x) = pi - arccos(x)",
      example: "\\arcsin(1/2) = \\frac{\\pi}{6}\n\\arctan(1) = \\frac{\\pi}{4}\n\\arccos(-1/2) = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}",
      commonErrors: "1. Забывают, что \\arccos(-x) = \\pi - \\arccos(x), а не -\\arccos(x).\n2. Подставляют аргумент вне отрезка [-1, 1] для арксинуса и арккосинуса."
    },
    kk: {
      title: "Кері тригонометриялық функциялар",
      description: "Арксинус, арккосинус, арктангенс, олардың анықталу және мәндер облысы.",
      whatIsIt: "Тригонометриялық функцияларға кері функциялар: \\arcsin(x) \\in [-\\pi/2, \\pi/2], \\arccos(x) \\in [0, \\pi], \\arctan(x) \\in (-\\pi/2, \\pi/2).",
      whenUsed: "Функцияның мәні бойынша бұрышты дәл есептеуде және геометриялық есептерде.",
      formulaLatex: "\\arcsin(-x) = -\\arcsin(x), \\quad \\arccos(-x) = \\pi - \\arccos(x), \\quad \\arcsin(x) + \\arccos(x) = \\frac{\\pi}{2}",
      formula: "arcsin(1/2) = pi/6, arccos(-x) = pi - arccos(x)",
      example: "\\arcsin(1/2) = \\frac{\\pi}{6}\n\\arctan(1) = \\frac{\\pi}{4}\n\\arccos(-1/2) = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}",
      commonErrors: "1. \\arccos(-x) = \\pi - \\arccos(x) формуласында \\pi-ді ұмытып, жай -\\arccos(x) деп жазу.\n2. Арксинус пен арккосинус үшін [-1, 1] аралығынан тыс мәндерді қарастыру."
    },
    en: {
      title: "Inverse Trigonometric Functions",
      description: "Arcsin, arccos, arctan, their domains, and principal value ranges.",
      whatIsIt: "Inverse functions of restricted trigonometric functions: \\arcsin(x) \\in [-\\pi/2, \\pi/2], \\arccos(x) \\in [0, \\pi], \\arctan(x) \\in (-\\pi/2, \\pi/2).",
      whenUsed: "Finding angles from known ratios and simplifying inverse trigonometric expressions.",
      formulaLatex: "\\arcsin(-x) = -\\arcsin(x), \\quad \\arccos(-x) = \\pi - \\arccos(x), \\quad \\arcsin(x) + \\arccos(x) = \\frac{\\pi}{2}",
      formula: "arcsin(1/2) = pi/6, arccos(-x) = pi - arccos(x)",
      example: "\\arcsin(1/2) = \\frac{\\pi}{6}\n\\arctan(1) = \\frac{\\pi}{4}\n\\arccos(-1/2) = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}",
      commonErrors: "1. Forgetting that \\arccos(-x) = \\pi - \\arccos(x) (not -\\arccos(x)).\n2. Applying arcsin or arccos outside the [-1, 1] domain."
    }
  },

  t13: {
    ru: {
      title: "Дифференциальные уравнения первого порядка",
      description: "Уравнения с разделяющимися переменными, линейные однородные и неоднородные уравнения.",
      whatIsIt: "Уравнения, связывающие независимую переменную x, неизвестную функцию y(x) и её первую производную y'.",
      whenUsed: "Моделирование охлаждения тел, радиоактивного распада, процессов в электрических цепях.",
      formulaLatex: "\\frac{dy}{dx} = f(x)g(y) \\implies \\int \\frac{dy}{g(y)} = \\int f(x) dx + C",
      formula: "dy/dx = f(x)*g(y), y' + p(x)y = 0",
      example: "\\frac{dy}{dx} = 2x \\implies y = \\int 2x dx = x^2 + C\ny' + y = 0 \\implies \\frac{dy}{y} = -dx \\implies y = C e^{-x}",
      commonErrors: "1. Потеря постоянной интегрирования C на промежуточных этапах.\n2. Ошибки при разделении переменных (деление на ноль при потере решений y = 0)."
    },
    kk: {
      title: "Бірінші ретті дифференциалдық теңдеулер",
      description: "Айнымалылары ажыратылатын теңдеулер, сызықтық біртекті және біртекті емес теңдеулер.",
      whatIsIt: "Тәуелсіз x айнымалысын, белгісіз y(x) функциясын және оның бірінші туындысы y'-ті байланыстыратын теңдеулер.",
      whenUsed: "Денелердің суу заңы, радиоактивті ыдырау, тізбектердегі ток өзгерісін сипаттауда.",
      formulaLatex: "\\frac{dy}{dx} = f(x)g(y) \\implies \\int \\frac{dy}{g(y)} = \\int f(x) dx + C",
      formula: "dy/dx = f(x)*g(y), y' + p(x)y = 0",
      example: "\\frac{dy}{dx} = 2x \\implies y = \\int 2x dx = x^2 + C\ny' + y = 0 \\implies \\frac{dy}{y} = -dx \\implies y = C e^{-x}",
      commonErrors: "1. Интегралдау тұрақтысы C-ны аралық қадамдарда жоғалтып алу.\n2. Айнымалыларды ажыратқанда нөлге бөлу қателігі салдарынан дербес шешімдерді жоғалту."
    },
    en: {
      title: "First-Order Differential Equations",
      description: "Separable equations, first-order linear homogeneous and non-homogeneous ODEs.",
      whatIsIt: "Equations relating the independent variable x, the unknown function y(x), and its first derivative y'.",
      whenUsed: "Newton's cooling law, radioactive decay modeling, and RL electric circuits.",
      formulaLatex: "\\frac{dy}{dx} = f(x)g(y) \\implies \\int \\frac{dy}{g(y)} = \\int f(x) dx + C",
      formula: "dy/dx = f(x)*g(y), y' + p(x)y = 0",
      example: "\\frac{dy}{dx} = 2x \\implies y = \\int 2x dx = x^2 + C\ny' + y = 0 \\implies \\frac{dy}{y} = -dx \\implies y = C e^{-x}",
      commonErrors: "1. Neglecting the arbitrary constant C early in integration.\n2. Loss of singular solutions when dividing by zero during variable separation."
    }
  },

  t14: {
    ru: {
      title: "Дифференциальные уравнения второго порядка",
      description: "Линейные однородные дифференциальные уравнения с постоянными коэффициентами.",
      whatIsIt: "Уравнения вида ay'' + by' + cy = 0. Решаются через составление характеристического уравнения ak^2 + bk + c = 0.",
      whenUsed: "Гармонические колебания маятника, колебательные RLC-контуры, резонанс.",
      formulaLatex: "a k^2 + b k + c = 0 \\implies y = C_1 e^{k_1 x} + C_2 e^{k_2 x} \\quad (k_1 \\neq k_2)",
      formula: "a*y'' + b*y' + c*y = 0, characteristic eq: a*k^2 + b*k + c = 0",
      example: "y'' - y = 0 \\implies k^2 - 1 = 0 \\implies k = \\pm 1\ny(x) = C_1 e^x + C_2 e^{-x}",
      commonErrors: "1. Путают форму общего решения при равных действительных корнях (забывают множитель x: (C_1 + C_2 x)e^{kx}).\n2. Ошибки в знаках при переходе к комплексным корням."
    },
    kk: {
      title: "Екінші ретті дифференциалдық теңдеулер",
      description: "Тұрақты коэффициентті сызықтық біртекті дифференциалдық теңдеулер.",
      whatIsIt: "ay'' + by' + cy = 0 түріндегі теңдеулер. Сипаттамалық ak^2 + bk + c = 0 теңдеуін құру арқылы шешіледі.",
      whenUsed: "Гармоникалық тербелістерде, тербелмелі RLC контурларында және резонансты зерттеуде.",
      formulaLatex: "a k^2 + b k + c = 0 \\implies y = C_1 e^{k_1 x} + C_2 e^{k_2 x} \\quad (k_1 \\neq k_2)",
      formula: "a*y'' + b*y' + c*y = 0, characteristic eq: a*k^2 + b*k + c = 0",
      example: "y'' - y = 0 \\implies k^2 - 1 = 0 \\implies k = \\pm 1\ny(x) = C_1 e^x + C_2 e^{-x}",
      commonErrors: "1. Еселі түбірлер кезінде x көбейткішін ұмыту: (C_1 + C_2 x)e^{kx}.\n2. Комплекс түбірлер кезінде синус пен косинустың аргументін шатастыру."
    },
    en: {
      title: "Second-Order Differential Equations",
      description: "Linear homogeneous second-order ODEs with constant coefficients and characteristic equations.",
      whatIsIt: "Equations of the form ay'' + by' + cy = 0, solved using the characteristic quadratic polynomial ak^2 + bk + c = 0.",
      whenUsed: "Harmonic oscillators, vibrating systems, and RLC electric circuits.",
      formulaLatex: "a k^2 + b k + c = 0 \\implies y = C_1 e^{k_1 x} + C_2 e^{k_2 x} \\quad (k_1 \\neq k_2)",
      formula: "a*y'' + b*y' + c*y = 0, characteristic eq: a*k^2 + b*k + c = 0",
      example: "y'' - y = 0 \\implies k^2 - 1 = 0 \\implies k = \\pm 1\ny(x) = C_1 e^x + C_2 e^{-x}",
      commonErrors: "1. Forgetting the factor of x in repeated root cases: (C_1 + C_2 x)e^{kx}.\n2. Algebraic sign blunders with complex conjugate roots."
    }
  },

  t15: {
    ru: {
      title: "Дробно-линейные функции",
      description: "Свойства функций y = (ax+b)/(cx+d), вертикальные и горизонтальные асимптоты.",
      whatIsIt: "Функция вида y = (ax+b)/(cx+d) (при c != 0 и ad - bc != 0). Графиком является равнобочная гипербола со смещенным центром.",
      whenUsed: "Нахождение асимптот, исследование функций, построение графиков и решение рациональных неравенств.",
      formulaLatex: "y = \\frac{ax+b}{cx+d}, \\quad x_{\\text{асимпт}} = -\\frac{d}{c}, \\quad y_{\\text{асимпт}} = \\frac{a}{c}",
      formula: "y = (ax+b)/(cx+d), vertical: x = -d/c, horizontal: y = a/c",
      example: "Функция $f(x) = \\frac{x+1}{x-2}$:\nОДЗ: $x \\neq 2$\nВертикальная асимптота: $x = 2$, горизонтальная асимптота: $y = 1$",
      commonErrors: "1. Забывают, что знаменатель не равен нулю (выколотая точка или асимптота).\n2. Путают коэффициенты при вычислении горизонтальной асимптоты y = a/c."
    },
    kk: {
      title: "Бөлшек-сызықтық функциялар",
      description: "y = (ax+b)/(cx+d) функцияларының қасиеттері, вертикаль және горизонталь асимптоталар.",
      whatIsIt: "y = (ax+b)/(cx+d) түріндегі функциялар (мұндағы c != 0 және ad - bc != 0). Графигі — центрлері жылжытылған гипербола.",
      whenUsed: "Асимптоталарды табу, функцияны зерттеу, графиктерді салу және бөлшек-рационал теңсіздіктерді шешу.",
      formulaLatex: "y = \\frac{ax+b}{cx+d}, \\quad x_{\\text{асимпт}} = -\\frac{d}{c}, \\quad y_{\\text{асимпт}} = \\frac{a}{c}",
      formula: "y = (ax+b)/(cx+d), vertical: x = -d/c, horizontal: y = a/c",
      example: "$f(x) = \\frac{x+1}{x-2}$ функциясы:\nММЖ: $x \\neq 2$\nВертикаль асимптота: $x = 2$, горизонталь асимптота: $y = 1$",
      commonErrors: "1. Бөлімнің нөлге тең болмау шартын ұмытып кету (анықталмаған нүкте).\n2. Горизонталь асимптотаны анықтағанда y = a/c қатынасын шатастыру."
    },
    en: {
      title: "Linear-Fractional Functions",
      description: "Properties of y = (ax+b)/(cx+d), vertical and horizontal asymptotes.",
      whatIsIt: "A rational function of the form y = (ax+b)/(cx+d) with c != 0 and ad - bc != 0. Its geometric plot is a hyperbola.",
      whenUsed: "Curve sketching, finding horizontal and vertical asymptotes, and solving fractional inequalities.",
      formulaLatex: "y = \\frac{ax+b}{cx+d}, \\quad x_{\\text{asympt}} = -\\frac{d}{c}, \\quad y_{\\text{asympt}} = \\frac{a}{c}",
      formula: "y = (ax+b)/(cx+d), vertical: x = -d/c, horizontal: y = a/c",
      example: "Function $f(x) = \\frac{x+1}{x-2}$:\nDomain: $x \\neq 2$\nVertical asymptote: $x = 2$, horizontal asymptote: $y = 1$",
      commonErrors: "1. Missing the vertical asymptote where the denominator equals zero.\n2. Inverting the ratio for the horizontal asymptote (using c/a instead of a/c)."
    }
  }
};

/**
 * Returns localized lesson content for a given topic ID and locale,
 * Kazakh content never falls back to Russian.
 */
export function getLocalizedLesson(topicId: string, locale: Locale): LessonContent | null {
  const topicData = topicLessons[topicId];
  if (!topicData) return null;
  return topicData[locale] || (locale === 'kk' ? null : topicData.ru) || null;
}
