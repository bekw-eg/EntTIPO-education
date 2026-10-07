import type { Locale } from "./types";

interface AnalysisCopy {
  result: string; correct: string; incorrect: string; partial: string;
  insight: string; neutral: string; unclassified: string; why: string;
  yourAnswer: string; correctAnswer: string; rule: string; example: string;
  retry: string; retryDescription: string; solve: string; finish: string;
  question: (number: number) => string;
  failedSteps: (count: number) => string;
}

export const analysisText: Record<Locale, AnalysisCopy> = {
  ru: {
    result: "Результат", correct: "Задание выполнено правильно", incorrect: "В этом задании есть ошибка",
    partial: "Часть решения верна", insight: "Что стоит повторить",
    neutral: "Сравни ответы, повтори правило и закрепи его в практике.",
    unclassified: "Точная причина ошибки по ответу не определена. Посмотри правильное решение, повтори правило и реши задание ещё раз.",
    why: "Почему?", yourAnswer: "Твой ответ", correctAnswer: "Правильный ответ",
    rule: "Что нужно запомнить", example: "Пример из этого задания",
    retry: "Теперь попробуй сам", retryDescription: "Реши это задание ещё раз, чтобы закрепить правило. Ответ уже был показан: это повторение с опорой на разбор.",
    solve: "Решить задание", finish: "Завершить тренировку",
    question: number => `Задание ${number}`,
    failedSteps: count => `Неверных шагов в этом задании: ${count}`,
  },
  kk: {
    result: "Нәтиже", correct: "Тапсырманы дұрыс орындадың", incorrect: "Бұл тапсырмада қате бар",
    partial: "Шешімнің бір бөлігі дұрыс", insight: "Нені қайталау керек",
    neutral: "Жауаптарды салыстырып, ережені қайтала және тапсырмамен бекіт.",
    unclassified: "Жауаптан қатенің нақты себебі анықталмады. Дұрыс шешімді қарап, ережені қайтала және тапсырманы қайта шеш.",
    why: "Неге?", yourAnswer: "Сенің жауабың", correctAnswer: "Дұрыс жауап",
    rule: "Нені есте сақтау керек", example: "Осы тапсырмадағы мысал",
    retry: "Қазір тексеріп көр", retryDescription: "Ережені бекіту үшін осы тапсырманы қайта шеш. Жауап бұрын көрсетілді: бұл — талдауға сүйеніп қайталау.",
    solve: "Тапсырманы шешу", finish: "Жаттығуды аяқтау",
    question: number => `${number}-тапсырма`,
    failedSteps: count => `Бұл тапсырмадағы қате қадамдар: ${count}`,
  },
  en: {
    result: "Result", correct: "You solved this task correctly", incorrect: "There is an error in this task",
    partial: "Part of your solution is correct", insight: "What to review",
    neutral: "Compare the answers, review the rule and reinforce it with practice.",
    unclassified: "The exact cause cannot be determined from this answer. Review the solution and rule, then try the task again.",
    why: "Why?", yourAnswer: "Your answer", correctAnswer: "Correct answer",
    rule: "What to remember", example: "Example from this task",
    retry: "Try it yourself now", retryDescription: "Solve this task again to reinforce the rule. The answer has already been shown: this is practice using the review.",
    solve: "Solve the task", finish: "Finish practice",
    question: number => `Task ${number}`,
    failedSteps: count => `Incorrect steps in this task: ${count}`,
  },
};
