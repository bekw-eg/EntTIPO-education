import type { Locale } from "./types";

export const interfaceText: Record<Locale, {
  more: string; navigation: string; close: string; skip: string; account: string;
  loadError: string; retry: string; emptyProgress: string; emptyProgressHint: string;
  noHistory: string; noLesson: string; noSkills: string; otherSkills: string; noReviews: string; noReviewsHint: string;
  noMatches: string; resetFilters: string; offline: string; notFound: string; notFoundHint: string;
}> = {
  ru: {
    more: "Ещё", navigation: "Разделы", close: "Закрыть", skip: "Перейти к содержимому", account: "Меню аккаунта",
    loadError: "Не удалось загрузить данные. Проверьте соединение и повторите попытку.", retry: "Повторить загрузку",
    emptyProgress: "Здесь будет ваш прогресс", emptyProgressHint: "Решите первые задания или пройдите диагностику, чтобы выбрать направление подготовки.",
    noHistory: "В этой тренировке ещё нет ответов.", noLesson: "Материал по этой теме пока не опубликован.",
    noSkills: "Данные о навыках появятся после диагностики или тренировки.", otherSkills: "Другие навыки", noReviews: "На сегодня повторений нет",
    noReviewsHint: "Можно продолжить учебный путь или решить новые задания.", noMatches: "По выбранным фильтрам ничего не найдено.",
    resetFilters: "Сбросить фильтры", offline: "Офлайн-практика", notFound: "Страница не найдена", notFoundHint: "Возможно, ссылка устарела. Вернитесь к подготовке.",
  },
  kk: {
    more: "Тағы", navigation: "Бөлімдер", close: "Жабу", skip: "Мазмұнға өту", account: "Аккаунт мәзірі",
    loadError: "Деректер жүктелмеді. Байланысты тексеріп, қайталап көріңіз.", retry: "Қайта жүктеу",
    emptyProgress: "Мұнда жетістігіңіз көрсетіледі", emptyProgressHint: "Дайындық бағытын таңдау үшін алғашқы тапсырмаларды шешіңіз немесе диагностикадан өтіңіз.",
    noHistory: "Бұл жаттығуда әзірге жауап жоқ.", noLesson: "Бұл тақырыптың материалы әзірге жарияланбаған.",
    noSkills: "Дағдылар туралы деректер диагностикадан немесе жаттығудан кейін көрсетіледі.", otherSkills: "Басқа дағдылар", noReviews: "Бүгін қайталау қажет емес",
    noReviewsHint: "Оқу жолын жалғастыруға немесе жаңа тапсырмаларды шешуге болады.", noMatches: "Таңдалған сүзгілер бойынша ештеңе табылмады.",
    resetFilters: "Сүзгілерді тазарту", offline: "Желісіз жаттығу", notFound: "Бет табылмады", notFoundHint: "Сілтеме ескірген болуы мүмкін. Дайындыққа оралыңыз.",
  },
  en: {
    more: "More", navigation: "Navigation", close: "Close", skip: "Skip to content", account: "Account menu",
    loadError: "Could not load the data. Check your connection and try again.", retry: "Try again",
    emptyProgress: "Your progress starts here", emptyProgressHint: "Solve your first questions or take a diagnostic to find your next learning step.",
    noHistory: "No answers in this session yet.", noLesson: "This lesson has not been published yet.",
    noSkills: "Skill progress will appear after a diagnostic or practice session.", otherSkills: "Other skills", noReviews: "No reviews due today",
    noReviewsHint: "Continue your learning road or work on new questions.", noMatches: "No results match these filters.",
    resetFilters: "Reset filters", offline: "Offline practice", notFound: "Page not found", notFoundHint: "This link may be out of date. Return to your learning.",
  },
};
