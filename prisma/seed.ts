import { PrismaClient } from '@prisma/client'
import { seedSkills } from './skillSeed'
import { seedExamBank } from './examSeed'

const prisma = new PrismaClient()

async function main() {
  const userId = 'cluser0000000000000000001'

  // 1. Create User
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: 'Test Student',
      email: 'student@example.com',
    },
  })

  // 2. Define Topics Data
  const topicsData = [
    {
      id: 't1',
      name: 'Корни и степени',
      description: 'Изучение свойств степеней и корней.',
      order: 1,
      lesson: {
        title: 'Корни и степени',
        whatIsIt: 'Степень показывает, сколько раз число умножается само на себя. Корень — это обратная операция к возведению в степень.',
        whenUsed: 'В расчетах, геометрии, физике для записи очень больших или малых чисел.',
        formula: 'a^n * a^m = a^(n+m), a^(1/n) = nth-root(a)',
        formulaLatex: 'a^n \\cdot a^m = a^{n+m}, a^{\\frac{1}{n}} = \\sqrt[n]{a}',
        example: '2^3 = 2 * 2 * 2 = 8. sqrt(9) = 3.',
        commonErrors: 'Путаница при сложении и умножении показателей, забывают про ОДЗ четных корней.'
      }
    },
    {
      id: 't2',
      name: 'Многочлены',
      description: 'Действия с многочленами, формулы сокращенного умножения.',
      order: 2,
      lesson: {
        title: 'Многочлены',
        whatIsIt: 'Многочлен — это алгебраическое выражение, представляющее собой сумму одночленов.',
        whenUsed: 'Основа алгебры, используется для аппроксимации функций и решения уравнений.',
        formula: '(a+b)^2 = a^2 + 2ab + b^2',
        formulaLatex: '(a+b)^2 = a^2 + 2ab + b^2',
        example: '(x+1)^2 = x^2 + 2x + 1',
        commonErrors: 'Забывают удвоенное произведение в квадрате суммы, путают знаки при раскрытии скобок.'
      }
    },
    {
      id: 't3',
      name: 'Комплексные числа',
      description: 'Числа вида a + bi, их свойства и операции над ними.',
      order: 3,
      lesson: {
        title: 'Комплексные числа',
        whatIsIt: 'Расширение множества действительных чисел, включающее мнимую единицу i, где i^2 = -1.',
        whenUsed: 'В электротехнике, квантовой механике, обработке сигналов.',
        formula: 'z = a + bi',
        formulaLatex: 'z = a + bi, i^2 = -1',
        example: '(1+i) + (2-i) = 3',
        commonErrors: 'Ошибки при возведении i в квадрат, неправильное вычисление модуля.'
      }
    },
    {
      id: 't4',
      name: 'Производная',
      description: 'Понятие производной, правила дифференцирования.',
      order: 4,
      lesson: {
        title: 'Производная',
        whatIsIt: 'Производная характеризует скорость изменения функции в данной точке.',
        whenUsed: 'Оптимизация, физика (скорость, ускорение), экономика (маржинальные издержки).',
        formula: '(x^n)\' = n*x^(n-1)',
        formulaLatex: '(x^n)\' = n x^{n-1}',
        example: '(x^2)\' = 2x',
        commonErrors: 'Ошибки в производной сложной функции (цепное правило), потеря коэффициентов.'
      }
    },
    {
      id: 't5',
      name: 'Касательная к графику',
      description: 'Геометрический смысл производной и уравнение касательной.',
      order: 5,
      lesson: {
        title: 'Касательная к графику',
        whatIsIt: 'Прямая, которая проходит через точку графика функции и имеет наклон, равный производной в этой точке.',
        whenUsed: 'Линейная аппроксимация функций.',
        formula: 'y = f(x0) + f\'(x0)(x - x0)',
        formulaLatex: 'y = f(x_0) + f\'(x_0)(x - x_0)',
        example: 'Для y=x^2 в x0=1: y = 1 + 2(x-1) = 2x-1',
        commonErrors: 'Путают f(x0) и f\'(x0), забывают умножить на (x-x0).'
      }
    },
    {
      id: 't6',
      name: 'Первообразная',
      description: 'Операция, обратная дифференцированию.',
      order: 6,
      lesson: {
        title: 'Первообразная',
        whatIsIt: 'Первообразная для функции f(x) — это такая функция F(x), что F\'(x) = f(x).',
        whenUsed: 'Для нахождения площади под графиком, решения простейших дифференциальных уравнений.',
        formula: 'F\'(x) = f(x)',
        formulaLatex: 'F\'(x) = f(x)',
        example: 'Для f(x)=2x первообразная F(x)=x^2+C',
        commonErrors: 'Забывают константу C, ошибки при интегрировании степеней.'
      }
    },
    {
      id: 't7',
      name: 'Интегралы',
      description: 'Определенный интеграл и формула Ньютона-Лейбница.',
      order: 7,
      lesson: {
        title: 'Интегралы',
        whatIsIt: 'Инструмент для вычисления площадей криволинейных фигур и других накопленных величин.',
        whenUsed: 'Расчет площади, объема, работы в физике.',
        formula: 'int_a^b f(x)dx = F(b) - F(a)',
        formulaLatex: '\\int_a^b f(x) dx = F(b) - F(a)',
        example: 'int_0^1 2x dx = 1^2 - 0^2 = 1',
        commonErrors: 'Ошибки в знаках при подстановке пределов интегрирования.'
      }
    },
    {
      id: 't8',
      name: 'Экспоненциальные интегралы',
      description: 'Интегрирование функций, содержащих экспоненту.',
      order: 8,
      lesson: {
        title: 'Экспоненциальные интегралы',
        whatIsIt: 'Специальные методы для интегрирования выражений вида e^x * f(x).',
        whenUsed: 'Анализ цепей переменного тока, вероятностные модели.',
        formula: 'int e^x dx = e^x + C',
        formulaLatex: '\\int e^x dx = e^x + C',
        example: 'int 2e^(2x) dx = e^(2x) + C',
        commonErrors: 'Неправильное применение интегрирования по частям, потеря коэффициентов в показателе.'
      }
    },
    {
      id: 't9',
      name: 'Логарифмические функции',
      description: 'Свойства логарифмов и их графики.',
      order: 9,
      lesson: {
        title: 'Логарифмические функции',
        whatIsIt: 'Логарифм показывает, в какую степень нужно возвести основание, чтобы получить данное число.',
        whenUsed: 'Шкала Рихтера, измерение уровня звука (децибелы), время распада.',
        formula: 'log_a(b) = c <=> a^c = b',
        formulaLatex: '\\log_a(b) = c \\iff a^c = b',
        example: 'log_2(8) = 3',
        commonErrors: 'Забывают область допустимых значений (логарифм только от положительных чисел).'
      }
    },
    {
      id: 't10',
      name: 'Показательные функции',
      description: 'Уравнения и неравенства с показательной функцией.',
      order: 10,
      lesson: {
        title: 'Показательные функции',
        whatIsIt: 'Функции вида f(x) = a^x, где a > 0 и a != 1.',
        whenUsed: 'Моделирование роста популяций, радиоактивный распад.',
        formula: 'a^x = b <=> x = log_a(b)',
        formulaLatex: 'a^x = b \\iff x = \\log_a(b)',
        example: '3^x = 9 => x = 2',
        commonErrors: 'Ошибки при приведении к общему основанию, игнорирование знака при решении неравенств (если 0 < a < 1).'
      }
    },
    {
      id: 't11',
      name: 'Тригонометрия',
      description: 'Тригонометрические тождества и простейшие уравнения.',
      order: 11,
      lesson: {
        title: 'Тригонометрия',
        whatIsIt: 'Изучение связей между углами и сторонами треугольников, а также периодических функций.',
        whenUsed: 'Анализ волн, механика, переменный ток.',
        formula: 'sin^2(x) + cos^2(x) = 1',
        formulaLatex: '\\sin^2(x) + \\cos^2(x) = 1',
        example: 'sin(pi/6) = 1/2',
        commonErrors: 'Путают знаки функций в разных четвертях, ошибки в периодах при решении уравнений.'
      }
    },
    {
      id: 't12',
      name: 'Обратные тригонометрические функции',
      description: 'Арксинус, арккосинус, арктангенс.',
      order: 12,
      lesson: {
        title: 'Обратные тригонометрические функции',
        whatIsIt: 'Функции, обратные тригонометрическим. Позволяют найти угол по значению функции.',
        whenUsed: 'В геометрии для нахождения углов по сторонам.',
        formula: 'arcsin(sin(x)) = x для x in [-pi/2, pi/2]',
        formulaLatex: '\\arcsin(\\sin(x)) = x, x \\in [-\\pi/2, \\pi/2]',
        example: 'arcsin(1) = pi/2',
        commonErrors: 'Забывают про область значений обратных функций.'
      }
    },
    {
      id: 't13',
      name: 'ДУ первого порядка',
      description: 'Дифференциальные уравнения первого порядка.',
      order: 13,
      lesson: {
        title: 'ДУ первого порядка',
        whatIsIt: 'Уравнения, связывающие функцию, её аргумент и первую производную.',
        whenUsed: 'Охлаждение тел, радиоактивный распад, химическая кинетика.',
        formula: 'dy/dx = f(x,y)',
        formulaLatex: '\\frac{dy}{dx} = f(x,y)',
        example: 'y\' = y => y = Ce^x',
        commonErrors: 'Ошибки при разделении переменных, потеря константы интегрирования.'
      }
    },
    {
      id: 't14',
      name: 'ДУ второго порядка',
      description: 'Линейные дифференциальные уравнения второго порядка.',
      order: 14,
      lesson: {
        title: 'ДУ второго порядка',
        whatIsIt: 'Уравнения, содержащие вторую производную неизвестной функции.',
        whenUsed: 'Механические колебания, электрические цепи (RLC контур).',
        formula: 'ay\'\' + by\' + cy = 0',
        formulaLatex: 'ay\'\' + by\' + cy = 0',
        example: 'y\'\' + y = 0 => y = C1cos(x) + C2sin(x)',
        commonErrors: 'Ошибки в корнях характеристического уравнения (особенно комплексных).'
      }
    },
    {
      id: 't15',
      name: 'Дробно-линейные функции',
      description: 'Функции вида y = (ax+b)/(cx+d).',
      order: 15,
      lesson: {
        title: 'Дробно-линейные функции',
        whatIsIt: 'Рациональные функции, график которых — гипербола.',
        whenUsed: 'Оптика (формула линзы), экономика.',
        formula: 'y = (ax+b)/(cx+d)',
        formulaLatex: 'y = \\frac{ax+b}{cx+d}',
        example: 'y = 1/x',
        commonErrors: 'Забывают про асимптоты, деление на ноль в ОДЗ.'
      }
    }
  ]

  // Create Topics & Lessons
  for (const t of topicsData) {
    const { lesson, ...topicData } = t
    await prisma.topic.upsert({
      where: { id: t.id },
      update: {
        ...topicData,
      },
      create: {
        ...topicData,
        lesson: {
          create: lesson
        }
      }
    })
  }

  // 3. Questions Data
  const questionsData = [
    // Topic 1
    {
      id: 'q1_t1', topicId: 't1', title: 'Упрощение корней', questionText: 'Упростить: (sqrt(75) - sqrt(48)) / sqrt(3)', difficulty: 1, correctAnswer: '1', answerType: 'expression', explanation: 'sqrt(75) = 5*sqrt(3). sqrt(48) = 4*sqrt(3). Разность равна sqrt(3). При делении на sqrt(3) получаем 1.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Как упростить корни?', expectedAnswer: 'Вынести множитель из-под корня', options: [{ text: 'Вынести множитель из-под корня', isCorrect: true }, { text: 'Перемножить числители', isCorrect: false }, { text: 'Применить формулу разности квадратов', isCorrect: false }, { text: 'Логарифмировать', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Упрости sqrt(75)', expectedAnswer: '5*sqrt(3)' },
        { order: 3, type: 'expression_input', prompt: 'Упрости sqrt(48)', expectedAnswer: '4*sqrt(3)' },
        { order: 4, type: 'expression_input', prompt: 'Вычисли (5*sqrt(3) - 4*sqrt(3)) / sqrt(3)', expectedAnswer: '1' }
      ]
    },
    {
      id: 'q2_t1', topicId: 't1', title: 'Дробная степень', questionText: 'Найти значение 27^(2/3)', difficulty: 2, correctAnswer: '9', answerType: 'number', explanation: '27^(1/3) = 3. 3^2 = 9.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Как вычислить дробную степень?', expectedAnswer: 'Корень из степени', options: [{ text: 'Корень из степени', isCorrect: true }, { text: 'Умножить на знаменатель', isCorrect: false }, { text: 'Логарифм основания', isCorrect: false }, { text: 'Умножить показатели', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: '27^(1/3) = ?', expectedAnswer: '3' },
        { order: 3, type: 'numeric_input', prompt: '3^2 = ?', expectedAnswer: '9' }
      ]
    },
    {
      id: 'q3_t1', topicId: 't1', title: 'Умножение степеней', questionText: 'Упростить: x^(3/2) * x^(1/2)', difficulty: 2, correctAnswer: 'x^2', answerType: 'expression', explanation: 'При умножении с одинаковым основанием показатели складываются: 3/2 + 1/2 = 4/2 = 2.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Какое правило применить?', expectedAnswer: 'Сложить показатели при умножении', options: [{ text: 'Сложить показатели при умножении', isCorrect: true }, { text: 'Умножить показатели', isCorrect: false }, { text: 'Вычесть показатели', isCorrect: false }, { text: 'Возвести в квадрат', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Чему равна 3/2 + 1/2?', expectedAnswer: '2' },
        { order: 3, type: 'expression_input', prompt: 'Итоговый ответ', expectedAnswer: 'x**2' }
      ]
    },

    // Topic 2
    {
      id: 'q1_t2', topicId: 't2', title: 'Разложение квадратного трёхчлена', questionText: 'Разложить на множители: x^2 - 5x + 6', difficulty: 2, correctAnswer: '(x-2)*(x-3)', answerType: 'expression', explanation: 'Корни уравнения x^2-5x+6=0 это x=2 и x=3. По формуле a(x-x1)(x-x2) получаем (x-2)*(x-3).',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Как разложить квадратный трёхчлен?', expectedAnswer: 'Найти корни уравнения', options: [{ text: 'Найти корни уравнения', isCorrect: true }, { text: 'Вынести x за скобку', isCorrect: false }, { text: 'Применить формулу куба', isCorrect: false }, { text: 'Разделить на x', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'Найди x1 (меньший корень)', expectedAnswer: '2' },
        { order: 3, type: 'numeric_input', prompt: 'Найди x2 (больший корень)', expectedAnswer: '3' },
        { order: 4, type: 'expression_input', prompt: 'Запиши в виде произведения', expectedAnswer: '(x-2)*(x-3)' }
      ]
    },
    {
      id: 'q2_t2', topicId: 't2', title: 'Квадрат суммы', questionText: 'Вычислить (2x+3)^2 при x=1', difficulty: 1, correctAnswer: '25', answerType: 'number', explanation: 'Подставим x=1: (2*1+3)^2 = 5^2 = 25.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Формула квадрата суммы?', expectedAnswer: 'a^2 + 2ab + b^2', options: [{ text: 'a^2 + 2ab + b^2', isCorrect: true }, { text: 'a^2 - 2ab + b^2', isCorrect: false }, { text: 'a^2 + b^2', isCorrect: false }, { text: '2a + 2b', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'Подставь x=1: (2*1+3)^2 = ?', expectedAnswer: '25' }
      ]
    },
    {
      id: 'q3_t2', topicId: 't2', title: 'Разность кубов', questionText: 'Разделить x^3 - 8 на (x-2)', difficulty: 3, correctAnswer: 'x^2+2*x+4', answerType: 'expression', explanation: 'x^3-8 = (x-2)(x^2+2x+4). Делим на x-2, остается x^2+2x+4.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'x^3 - 8 — это...', expectedAnswer: 'Разность кубов', options: [{ text: 'Разность кубов', isCorrect: true }, { text: 'Разность квадратов', isCorrect: false }, { text: 'Полный куб', isCorrect: false }, { text: 'Квадратный трёхчлен', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Формула разности кубов a^3-b^3 = ?', expectedAnswer: '(a-b)*(a**2+a*b+b**2)' },
        { order: 3, type: 'expression_input', prompt: 'Результат деления', expectedAnswer: 'x**2+2*x+4' }
      ]
    },

    // Topic 3
    {
      id: 'q1_t3', topicId: 't3', title: 'Умножение сопряженных', questionText: 'Вычислить (2+3i)(2-3i)', difficulty: 2, correctAnswer: '13', answerType: 'number', explanation: 'По формуле разности квадратов 2^2 - (3i)^2 = 4 - 9(-1) = 13.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: '(a+bi)(a-bi) = ?', expectedAnswer: 'a^2 + b^2', options: [{ text: 'a^2 + b^2', isCorrect: true }, { text: 'a^2 - b^2', isCorrect: false }, { text: '2a', isCorrect: false }, { text: 'a^2 - b^2i', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: '2^2 = ?', expectedAnswer: '4' },
        { order: 3, type: 'numeric_input', prompt: '3^2 = ?', expectedAnswer: '9' },
        { order: 4, type: 'numeric_input', prompt: 'Итог 4 + 9 = ?', expectedAnswer: '13' }
      ]
    },
    {
      id: 'q2_t3', topicId: 't3', title: 'Модуль комплексного числа', questionText: 'Найти |3+4i|', difficulty: 2, correctAnswer: '5', answerType: 'number', explanation: '|a+bi| = sqrt(a^2+b^2). sqrt(3^2+4^2) = sqrt(25) = 5.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Формула модуля комплексного числа?', expectedAnswer: 'sqrt(a^2+b^2)', options: [{ text: 'sqrt(a^2+b^2)', isCorrect: true }, { text: 'a+b', isCorrect: false }, { text: 'sqrt(a^2-b^2)', isCorrect: false }, { text: 'a*b', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: '3^2 + 4^2 = ?', expectedAnswer: '25' },
        { order: 3, type: 'numeric_input', prompt: 'sqrt(25) = ?', expectedAnswer: '5' }
      ]
    },

    // Topic 4
    {
      id: 'q1_t4', topicId: 't4', title: 'Производная многочлена', questionText: 'Найти производную f(x) = x^3 + 2x^2 - 5x + 1', difficulty: 2, correctAnswer: '3*x**2 + 4*x - 5', answerType: 'expression', explanation: 'Применяем правило производной суммы и степени: 3x^2 + 4x - 5.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Правило дифференцирования степени x^n', expectedAnswer: 'n*x^(n-1)', options: [{ text: 'n*x^(n-1)', isCorrect: true }, { text: 'x^n / n', isCorrect: false }, { text: 'n*x^n', isCorrect: false }, { text: 'x^(n+1)', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Производная x^3', expectedAnswer: '3*x**2' },
        { order: 3, type: 'expression_input', prompt: 'Производная 2x^2', expectedAnswer: '4*x' },
        { order: 4, type: 'expression_input', prompt: 'Полная производная', expectedAnswer: '3*x**2+4*x-5' }
      ]
    },
    {
      id: 'q2_t4', topicId: 't4', title: 'Производная произведения', questionText: 'Найти производную f(x) = sin(x) * e^x', difficulty: 3, correctAnswer: 'sin(x)*exp(x) + cos(x)*exp(x)', answerType: 'expression', explanation: 'По правилу произведения: u\'v + uv\'. cos(x)e^x + sin(x)e^x.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Какое правило?', expectedAnswer: 'Правило произведения', options: [{ text: 'Правило произведения', isCorrect: true }, { text: 'Правило частного', isCorrect: false }, { text: 'Цепное правило', isCorrect: false }, { text: 'Линейность', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Производная sin(x)', expectedAnswer: 'cos(x)' },
        { order: 3, type: 'expression_input', prompt: 'Производная e^x', expectedAnswer: 'exp(x)' },
        { order: 4, type: 'expression_input', prompt: '(uv)\' = u\'v + uv\' = ?', expectedAnswer: 'cos(x)*exp(x)+sin(x)*exp(x)' }
      ]
    },
    {
      id: 'q3_t4', topicId: 't4', title: 'Производная сложной логарифмической функции', questionText: 'Найти f\'(x) если f(x) = ln(x^2+1)', difficulty: 3, correctAnswer: '2*x/(x**2+1)', answerType: 'expression', explanation: 'Цепное правило: 1/(x^2+1) * (x^2+1)\' = 2x/(x^2+1).',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Правило дифференцирования ln(g(x))?', expectedAnswer: 'g\'(x)/g(x)', options: [{ text: 'g\'(x)/g(x)', isCorrect: true }, { text: '1/x', isCorrect: false }, { text: 'ln(g\'(x))', isCorrect: false }, { text: 'g(x)/g\'(x)', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Производная (x^2+1) = ?', expectedAnswer: '2*x' },
        { order: 3, type: 'expression_input', prompt: 'Итог: 2x/(x^2+1)', expectedAnswer: '2*x/(x**2+1)' }
      ]
    },

    // Topic 5
    {
      id: 'q1_t5', topicId: 't5', title: 'Уравнение касательной', questionText: 'Уравнение касательной к f(x)=x^2 в точке x=2', difficulty: 2, correctAnswer: 'y = 4*x - 4', answerType: 'expression', explanation: 'f(2)=4, f\'(x)=2x, f\'(2)=4. Уравнение: y = 4 + 4(x-2) = 4x-4.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Уравнение касательной', expectedAnswer: 'y = f(x0) + f\'(x0)*(x-x0)', options: [{ text: 'y = f(x0) + f\'(x0)*(x-x0)', isCorrect: true }, { text: 'y = f\'(x0)*x', isCorrect: false }, { text: 'y = f(x0)*x', isCorrect: false }, { text: 'y = f(x0) - f\'(x0)*(x-x0)', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'f(2) = 2^2 = ?', expectedAnswer: '4' },
        { order: 3, type: 'expression_input', prompt: 'f\'(x) = ?', expectedAnswer: '2*x' },
        { order: 4, type: 'numeric_input', prompt: 'f\'(2) = ?', expectedAnswer: '4' },
        { order: 5, type: 'expression_input', prompt: 'y = f(x0) + k*(x-x0): y = ?', expectedAnswer: '4*x-4' }
      ]
    },

    // Topic 6
    {
      id: 'q1_t6', topicId: 't6', title: 'Простейшая первообразная', questionText: 'Найти первообразную F(x) для f(x) = 3x^2 + 2x', difficulty: 2, correctAnswer: 'x**3 + x**2', answerType: 'expression', explanation: 'Первообразная 3x^2 это x^3. Первообразная 2x это x^2.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Правило нахождения первообразной степени?', expectedAnswer: 'x^(n+1)/(n+1)', options: [{ text: 'x^(n+1)/(n+1)', isCorrect: true }, { text: 'n*x^(n-1)', isCorrect: false }, { text: 'x^n*n', isCorrect: false }, { text: 'x^(n-1)/(n-1)', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Первообразная 3x^2', expectedAnswer: 'x**3' },
        { order: 3, type: 'expression_input', prompt: 'Первообразная 2x', expectedAnswer: 'x**2' },
        { order: 4, type: 'expression_input', prompt: 'F(x) = ?', expectedAnswer: 'x**3+x**2' }
      ]
    },
    {
      id: 'q2_t6', topicId: 't6', title: 'Первообразная гиперболы', questionText: 'Найти ∫(1/x)dx', difficulty: 2, correctAnswer: 'ln(|x|) + C', answerType: 'expression', explanation: 'Табличный интеграл: ln|x| + C.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: '∫(1/x)dx = ?', expectedAnswer: 'ln|x| + C', options: [{ text: 'ln|x| + C', isCorrect: true }, { text: '1/x^2 + C', isCorrect: false }, { text: '-1/x^2 + C', isCorrect: false }, { text: 'x*ln(x) + C', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Запиши ответ', expectedAnswer: 'ln(x)' }
      ]
    },

    // Topic 7
    {
      id: 'q1_t7', topicId: 't7', title: 'Определенный интеграл многочлена', questionText: 'Вычислить ∫(from 0 to 2) x^2 dx', difficulty: 2, correctAnswer: '8/3', answerType: 'expression', explanation: 'Первообразная x^3/3. F(2)-F(0) = 8/3 - 0 = 8/3.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Формула Ньютона-Лейбница', expectedAnswer: 'F(b) - F(a)', options: [{ text: 'F(b) - F(a)', isCorrect: true }, { text: 'f(b) - f(a)', isCorrect: false }, { text: 'F(a) + F(b)', isCorrect: false }, { text: 'f(a)*f(b)', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Первообразная x^2', expectedAnswer: 'x**3/3' },
        { order: 3, type: 'expression_input', prompt: 'F(2) = ?', expectedAnswer: '8/3' },
        { order: 4, type: 'expression_input', prompt: 'F(0) = ?', expectedAnswer: '0' },
        { order: 5, type: 'expression_input', prompt: 'F(2) - F(0) = ?', expectedAnswer: '8/3' }
      ]
    },
    {
      id: 'q2_t7', topicId: 't7', title: 'Интеграл экспоненты', questionText: 'Вычислить ∫ 5e^(2x) dx', difficulty: 3, correctAnswer: '5*exp(2*x)/2', answerType: 'expression', explanation: 'Интеграл e^(ax) = 1/a * e^(ax). Получаем 5/2 e^(2x).',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Метод интегрирования', expectedAnswer: 'Формула интеграла экспоненты', options: [{ text: 'Формула интеграла экспоненты', isCorrect: true }, { text: 'Интегрирование по частям', isCorrect: false }, { text: 'Тригонометрическая замена', isCorrect: false }, { text: 'Формула логарифма', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: '∫e^(ax)dx = ?', expectedAnswer: 'exp(a*x)/a' },
        { order: 3, type: 'numeric_input', prompt: 'Коэффициент a = ?', expectedAnswer: '2' },
        { order: 4, type: 'expression_input', prompt: '5 * (e^(2x)/2) = ?', expectedAnswer: '5*exp(2*x)/2' }
      ]
    },
    {
      id: 'q3_t7', topicId: 't7', title: 'Интеграл косинуса', questionText: 'Вычислить ∫ cos(x) dx', difficulty: 1, correctAnswer: 'sin(x)', answerType: 'expression', explanation: 'Производная синуса равна косинусу, значит интеграл косинуса — это синус.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: '∫cos(x)dx = ?', expectedAnswer: 'sin(x) + C', options: [{ text: 'sin(x) + C', isCorrect: true }, { text: '-sin(x) + C', isCorrect: false }, { text: 'cos(x) + C', isCorrect: false }, { text: '-cos(x) + C', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Ответ (без C)', expectedAnswer: 'sin(x)' }
      ]
    },

    // Topic 8
    {
      id: 'q1_t8', topicId: 't8', title: 'Интегрирование по частям', questionText: 'Вычислить ∫ e^x * sin(x) dx', difficulty: 4, correctAnswer: 'exp(x)*(sin(x)-cos(x))/2', answerType: 'expression', explanation: 'Интегрирование по частям (дважды) приводит к уравнению I = e^x sin x - e^x cos x - I.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Метод?', expectedAnswer: 'Интегрирование по частям', options: [{ text: 'Интегрирование по частям', isCorrect: true }, { text: 'Замена переменной', isCorrect: false }, { text: 'Частичные дроби', isCorrect: false }, { text: 'Формула экспоненты', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Пусть u = e^x, dv = sin(x)dx, тогда v = ?', expectedAnswer: '-cos(x)' },
        { order: 3, type: 'expression_input', prompt: 'Ответ: e^x*(sin(x)-cos(x))/2', expectedAnswer: 'exp(x)*(sin(x)-cos(x))/2' }
      ]
    },
    {
      id: 'q2_t8', topicId: 't8', title: 'Интегрирование по частям 2', questionText: 'Вычислить ∫ x*e^x dx', difficulty: 3, correctAnswer: 'exp(x)*(x-1)', answerType: 'expression', explanation: 'По частям: u=x, dv=e^x dx. u\'=1, v=e^x. uv - ∫v du = x e^x - e^x.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Метод?', expectedAnswer: 'Интегрирование по частям', options: [{ text: 'Интегрирование по частям', isCorrect: true }, { text: 'Формула экспоненты', isCorrect: false }, { text: 'Замена переменной', isCorrect: false }, { text: 'Частичные дроби', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'u = x, dv = e^x dx → v = ?', expectedAnswer: 'exp(x)' },
        { order: 3, type: 'expression_input', prompt: 'uv - ∫v du = x*e^x - ∫e^x dx = ?', expectedAnswer: 'x*exp(x) - exp(x)' },
        { order: 4, type: 'expression_input', prompt: 'Упрощённый ответ', expectedAnswer: 'exp(x)*(x-1)' }
      ]
    },

    // Topic 9
    {
      id: 'q1_t9', topicId: 't9', title: 'Определение логарифма', questionText: 'Вычислить log_2(32)', difficulty: 1, correctAnswer: '5', answerType: 'number', explanation: '2^5 = 32.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'log_a(b) = x означает...', expectedAnswer: 'a^x = b', options: [{ text: 'a^x = b', isCorrect: true }, { text: 'x^a = b', isCorrect: false }, { text: 'b^a = x', isCorrect: false }, { text: 'a*x = b', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: '2^? = 32', expectedAnswer: '5' }
      ]
    },
    {
      id: 'q2_t9', topicId: 't9', title: 'Натуральный логарифм', questionText: 'Упростить ln(e^3)', difficulty: 1, correctAnswer: '3', answerType: 'number', explanation: 'ln(x) — это логарифм по основанию e. e^3 = e^3, поэтому ответ 3.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'ln(e^x) = ?', expectedAnswer: 'x', options: [{ text: 'x', isCorrect: true }, { text: 'e^x', isCorrect: false }, { text: 'ln(x)', isCorrect: false }, { text: '1/x', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'Ответ', expectedAnswer: '3' }
      ]
    },
    {
      id: 'q3_t9', topicId: 't9', title: 'Логарифмическое уравнение', questionText: 'Решить уравнение log_3(x+2) = 2', difficulty: 2, correctAnswer: '7', answerType: 'number', explanation: 'x+2 = 3^2 = 9. x = 7.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Перевести в показательную форму', expectedAnswer: 'x+2 = 3^2', options: [{ text: 'x+2 = 3^2', isCorrect: true }, { text: 'x+2 = 2^3', isCorrect: false }, { text: '3*(x+2) = 2', isCorrect: false }, { text: 'x+2 = 2*3', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: '3^2 = ?', expectedAnswer: '9' },
        { order: 3, type: 'numeric_input', prompt: 'x = 9 - 2 = ?', expectedAnswer: '7' }
      ]
    },

    // Topic 10
    {
      id: 'q1_t10', topicId: 't10', title: 'Показательное уравнение', questionText: 'Решить уравнение 2^x = 32', difficulty: 1, correctAnswer: '5', answerType: 'number', explanation: '32 = 2^5, значит x=5.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: '32 = 2^?', expectedAnswer: '5', options: [{ text: '5', isCorrect: true }, { text: '4', isCorrect: false }, { text: '6', isCorrect: false }, { text: '16', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'x = ?', expectedAnswer: '5' }
      ]
    },
    {
      id: 'q2_t10', topicId: 't10', title: 'Показательное уравнение сложнее', questionText: 'Решить 3^(x+1) = 27', difficulty: 2, correctAnswer: '2', answerType: 'number', explanation: '27 = 3^3, значит x+1=3, откуда x=2.',
      steps: [
        { order: 1, type: 'numeric_input', prompt: '27 = 3^?', expectedAnswer: '3' },
        { order: 2, type: 'expression_input', prompt: 'Составь уравнение: x+1 = ?', expectedAnswer: '3' },
        { order: 3, type: 'numeric_input', prompt: 'x = 3 - 1 = ?', expectedAnswer: '2' }
      ]
    },

    // Topic 11
    {
      id: 'q1_t11', topicId: 't11', title: 'Основное тригонометрическое тождество', questionText: 'Вычислить sin^2(x) + cos^2(x)', difficulty: 1, correctAnswer: '1', answerType: 'number', explanation: 'Это основное тригонометрическое тождество, всегда равно 1.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Основное тригонометрическое тождество', expectedAnswer: 'sin^2 + cos^2 = 1', options: [{ text: 'sin^2 + cos^2 = 1', isCorrect: true }, { text: 'sin^2 - cos^2 = 1', isCorrect: false }, { text: 'sin + cos = 1', isCorrect: false }, { text: 'sin*cos = 1', isCorrect: false }] },
        { order: 2, type: 'numeric_input', prompt: 'Ответ', expectedAnswer: '1' }
      ]
    },
    {
      id: 'q2_t11', topicId: 't11', title: 'Табличные значения', questionText: 'Найти sin(30°)', difficulty: 1, correctAnswer: '1/2', answerType: 'expression', explanation: 'По таблице значений тригонометрических функций sin(30°) = 1/2.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'sin(30°) = ?', expectedAnswer: '1/2', options: [{ text: '1/2', isCorrect: true }, { text: 'sqrt(3)/2', isCorrect: false }, { text: 'sqrt(2)/2', isCorrect: false }, { text: '1', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Запиши ответ', expectedAnswer: '1/2' }
      ]
    },
    {
      id: 'q3_t11', topicId: 't11', title: 'Тригонометрическое уравнение', questionText: 'Решить sin(x) = 0 на [0, 2π]', difficulty: 2, correctAnswer: '0, π, 2π', answerType: 'expression', explanation: 'Синус равен 0 при углах 0, π, 2π на заданном интервале.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Где sin = 0 на единичной окружности?', expectedAnswer: 'x = πn, n ∈ Z', options: [{ text: 'x = πn, n ∈ Z', isCorrect: true }, { text: 'x = π/2 + 2πn', isCorrect: false }, { text: 'x = π/4 + πn', isCorrect: false }, { text: 'x = 2πn', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'На [0,2π]: x = ? Запиши через запятую', expectedAnswer: '0' }
      ]
    },

    // Topic 12
    {
      id: 'q1_t12', topicId: 't12', title: 'Арксинус', questionText: 'Вычислить arcsin(1/2)', difficulty: 2, correctAnswer: 'π/6', answerType: 'expression', explanation: 'sin(π/6) = 1/2.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'arcsin(1/2) = ? (в радианах)', expectedAnswer: 'π/6', options: [{ text: 'π/6', isCorrect: true }, { text: 'π/4', isCorrect: false }, { text: 'π/3', isCorrect: false }, { text: 'π/2', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Запиши ответ', expectedAnswer: 'pi/6' }
      ]
    },
    {
      id: 'q2_t12', topicId: 't12', title: 'Арктангенс', questionText: 'Вычислить arctan(1)', difficulty: 2, correctAnswer: 'π/4', answerType: 'expression', explanation: 'tan(π/4) = 1.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'tan(x) = 1 при x = ?', expectedAnswer: 'π/4', options: [{ text: 'π/4', isCorrect: true }, { text: 'π/3', isCorrect: false }, { text: 'π/6', isCorrect: false }, { text: 'π/2', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'arctan(1) = ?', expectedAnswer: 'pi/4' }
      ]
    },

    // Topic 13
    {
      id: 'q1_t13', topicId: 't13', title: 'ДУ простейшее', questionText: 'Решить dy/dx = 2x', difficulty: 2, correctAnswer: 'x**2 + C', answerType: 'expression', explanation: 'Интегрируем обе части: y = x^2 + C.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Метод решения', expectedAnswer: 'Прямое интегрирование', options: [{ text: 'Прямое интегрирование', isCorrect: true }, { text: 'Разделение переменных', isCorrect: false }, { text: 'Подстановка Бернулли', isCorrect: false }, { text: 'Метод вариации констант', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: '∫2x dx = ?', expectedAnswer: 'x**2' },
        { order: 3, type: 'expression_input', prompt: 'Общее решение', expectedAnswer: 'x**2' }
      ]
    },
    {
      id: 'q2_t13', topicId: 't13', title: 'Разделение переменных', questionText: 'Решить y\' + y = 0', difficulty: 3, correctAnswer: 'C*exp(-x)', answerType: 'expression', explanation: 'dy/y = -dx => ln(y) = -x + C => y = Ce^(-x).',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Тип уравнения?', expectedAnswer: 'Линейное однородное', options: [{ text: 'Линейное однородное', isCorrect: true }, { text: 'Уравнение Бернулли', isCorrect: false }, { text: 'С разделяющимися переменными', isCorrect: false }, { text: 'Точное уравнение', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'dy/y = -dx → ∫dy/y = ?', expectedAnswer: 'ln(y)' },
        { order: 3, type: 'expression_input', prompt: 'Общее решение y = ?', expectedAnswer: 'C*exp(-x)' }
      ]
    },

    // Topic 14
    {
      id: 'q1_t14', topicId: 't14', title: 'Характеристическое уравнение', questionText: 'Решить y\'\' - y = 0', difficulty: 4, correctAnswer: 'C1*exp(x) + C2*exp(-x)', answerType: 'expression', explanation: 'Характеристическое уравнение: k^2 - 1 = 0. Корни k = 1, -1. Решение C1e^x + C2e^(-x).',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Составить характеристическое уравнение', expectedAnswer: 'k^2 - 1 = 0', options: [{ text: 'k^2 - 1 = 0', isCorrect: true }, { text: 'k^2 + 1 = 0', isCorrect: false }, { text: 'k - 1 = 0', isCorrect: false }, { text: 'k^2 = 1', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Корни k1, k2 = ?', expectedAnswer: '1, -1' },
        { order: 3, type: 'expression_input', prompt: 'Общее решение', expectedAnswer: 'C1*exp(x) + C2*exp(-x)' }
      ]
    },

    // Topic 15
    {
      id: 'q1_t15', topicId: 't15', title: 'Область определения', questionText: 'Найти область определения f(x) = 1/(x-3)', difficulty: 1, correctAnswer: 'x ≠ 3', answerType: 'expression', explanation: 'Знаменатель не может быть равен нулю. x-3 ≠ 0 => x ≠ 3.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Когда дробь не определена?', expectedAnswer: 'Когда знаменатель = 0', options: [{ text: 'Когда знаменатель = 0', isCorrect: true }, { text: 'Когда числитель = 0', isCorrect: false }, { text: 'Никогда', isCorrect: false }, { text: 'При x < 0', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'Реши x - 3 = 0', expectedAnswer: '3' },
        { order: 3, type: 'expression_input', prompt: 'Область определения', expectedAnswer: 'x != 3' }
      ]
    },
    {
      id: 'q2_t15', topicId: 't15', title: 'Вертикальная асимптота', questionText: 'Найти вертикальную асимптоту f(x) = (x+1)/(x-2)', difficulty: 2, correctAnswer: 'x = 2', answerType: 'expression', explanation: 'Знаменатель обращается в 0 при x=2, числитель при этом не 0. Это вертикальная асимптота.',
      steps: [
        { order: 1, type: 'multiple_choice', prompt: 'Вертикальная асимптота — это...', expectedAnswer: 'Значение x, при котором знаменатель = 0', options: [{ text: 'Значение x, при котором знаменатель = 0', isCorrect: true }, { text: 'Значение y при x→∞', isCorrect: false }, { text: 'Точка экстремума', isCorrect: false }, { text: 'Точка пересечения с осью x', isCorrect: false }] },
        { order: 2, type: 'expression_input', prompt: 'x - 2 = 0 → x = ?', expectedAnswer: '2' }
      ]
    },
  ]

  // Create Questions
  for (const q of questionsData) {
    const { steps, ...qData } = q
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        ...qData,
      },
      create: {
        ...qData,
        steps: {
          create: steps.map(s => {
            const { options, ...sData } = s
            return {
              ...sData,
              options: options ? {
                create: options.map((opt, i) => ({ ...opt, order: i + 1 }))
              } : undefined
            }
          })
        }
      }
    })
  }

  // 4. Create UserTopicProgress
  const progressData = [
    { topicId: 't1', masteryScore: 80, currentLevel: 3 },
    { topicId: 't2', masteryScore: 75, currentLevel: 3 },
    { topicId: 't3', masteryScore: 85, currentLevel: 3 },
    { topicId: 't4', masteryScore: 65, currentLevel: 2 },
    { topicId: 't5', masteryScore: 60, currentLevel: 2 },
    { topicId: 't6', masteryScore: 45, currentLevel: 1 },
    { topicId: 't7', masteryScore: 50, currentLevel: 1 },
    { topicId: 't8', masteryScore: 35, currentLevel: 1 },
    { topicId: 't9', masteryScore: 40, currentLevel: 1 },
    { topicId: 't10', masteryScore: 70, currentLevel: 3 },
    { topicId: 't11', masteryScore: 65, currentLevel: 2 },
    { topicId: 't12', masteryScore: 75, currentLevel: 3 },
    { topicId: 't13', masteryScore: 30, currentLevel: 1 },
    { topicId: 't14', masteryScore: 25, currentLevel: 1 },
    { topicId: 't15', masteryScore: 45, currentLevel: 1 },
  ]

  for (const p of progressData) {
    await prisma.userTopicProgress.upsert({
      where: { userId_topicId: { userId, topicId: p.topicId } },
      update: {
        masteryScore: p.masteryScore,
        currentLevel: p.currentLevel,
        totalAttempts: 10,
        correctAttempts: Math.floor(10 * (p.masteryScore / 100)),
        lastAttemptAt: new Date()
      },
      create: {
        userId,
        topicId: p.topicId,
        masteryScore: p.masteryScore,
        currentLevel: p.currentLevel,
        totalAttempts: 10,
        correctAttempts: Math.floor(10 * (p.masteryScore / 100)),
        lastAttemptAt: new Date()
      }
    })
  }

  await seedSkills(prisma)
  await seedExamBank(prisma)

  // 5. Create DailyGoal
  await prisma.dailyGoal.upsert({
    where: { userId_date: { userId, date: new Date() } },
    update: {},
    create: {
      userId,
      date: new Date(),
      targetCount: 20,
      completedCount: 5
    }
  })

  // 6. Create Mistakes (dummy data)
  // Get an existing question for mistake
  const mistakeQ = await prisma.question.findFirst({ where: { topicId: 't6' } })
  
  if (mistakeQ) {
    const session = await prisma.practiceSession.create({
      data: {
        userId,
        mode: 'mixed',
        totalCount: 10,
        completedCount: 1,
        topicId: 't6',
        status: 'completed',
        completedAt: new Date()
      }
    })

    const attempt = await prisma.userAttempt.create({
      data: {
        userId,
        questionId: mistakeQ.id,
        sessionId: session.id,
        isCorrect: false,
        score: 0
      }
    })

    await prisma.mistake.create({
      data: {
        userId,
        questionId: mistakeQ.id,
        attemptId: attempt.id,
        topicId: 't6',
        errorType: 'calculation_error',
        description: 'Забыл добавить C',
      }
    })
  }
}

main().then(async () => {
  const { seedKazakhContent } = await import('./kazakhSeed');
  await seedKazakhContent(prisma);
  const { seedPracticeChoices } = await import('./practiceChoiceSeed');
  await seedPracticeChoices(prisma);
})
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
