import type { Locale } from "./types";
import type { RoadNodeType, RoadReason, RoadStatus } from "../learning-road/types";

interface RoadCopy {
  title: string; intro: string; focus: string; progress: string; continue: string; start: string;
  nextBlock: string; finished: string; policy: string; why: string; mastery: string; insufficient: string;
  tasks: string; minutes: string; prerequisite: string; optional: string; diagnostic: string;
  diagnosticNote: string; empty: string; loading: string; error: string; reload: string;
  unavailable: string; skip: string; skipped: string; participation: string; passed: string; failed: string;
  read: string; back: string; invalidRequest: string;
  types: Record<RoadNodeType, string>; statuses: Record<RoadStatus, string>; reasons: Record<RoadReason, string>;
  errors: Record<"road_block_unfinished" | "road_node_missing" | "road_theory_only" | "road_not_unavailable" | "road_block_archived", string>;
}
export const roadText: Record<Locale, RoadCopy> = {
  ru: {
    title: "Мой путь", intro: "Ближайшие занятия по твоим результатам, повторениям и программе.",
    focus: "Текущий фокус", progress: "Прогресс блока", continue: "Продолжить путь", start: "Начать",
    nextBlock: "Следующий блок", finished: "Блок завершён. Построим следующий по новым результатам.",
    policy: "Порядок занятий сохраняется до конца блока. Любую тему можно открыть заранее.",
    why: "Почему предложено?", mastery: "Освоение", insufficient: "Недостаточно данных",
    tasks: "заданий", minutes: "мин", prerequisite: "Сначала рекомендуется закрепить", optional: "Рекомендация не ограничивает доступ к теме.",
    diagnostic: "Пройти диагностику", diagnosticNote: "Диагностика из 9 вопросов помогает выбрать начальное направление; остальные навыки изучим постепенно.",
    empty: "Сейчас нет доступных занятий. Можно выбрать тему или вернуться после следующего повторения.",
    loading: "Загружаем путь…", error: "Не удалось загрузить путь. Попробуй ещё раз.", reload: "Обновить",
    unavailable: "Сейчас нет нового задания для самостоятельной проверки либо повторение уже выполнено в другом занятии.",
    skip: "Продолжить без этой проверки", skipped: "Пропущено: проверка недоступна", participation: "Завершение занятия отмечает выполненную работу. Освоение определяется результатами ответов.",
    passed: "Самостоятельная проверка пройдена", failed: "Проверка выполнена; навык ещё требует закрепления.",
    read: "Я прочитал правило", back: "Вернуться к пути", invalidRequest: "Некорректный запрос учебного пути",
    types: { THEORY: "Теория", PRACTICE: "Практика", REPAIR: "Закрепление", REVIEW: "Повторение", CHECKPOINT: "Проверка" },
    statuses: { COMPLETED: "Выполнено", CURRENT: "Сейчас", UPCOMING: "Впереди" },
    reasons: {
      weak: "По этому навыку результат ниже целевого. Короткая практика поможет его закрепить.",
      due: "При построении блока наступил срок назначенного повторения 1/3/7/14.",
      coverage: "Этот навык ещё недостаточно проверен. Соберём данные и расширим покрытие программы.",
      evidence: "Данных для уверенной оценки пока недостаточно. Продолжим практику по этому навыку.",
      prerequisite: "Этот базовый навык явно указан в программе как подготовка к одному из следующих занятий.",
      checkpoint: "После занятий проверим выбранный навык на другом задании без помощи.",
      freshness: "При построении блока этот навык давно не встречался. Освежим его короткой практикой.",
      maintenance: "Продолжим практику по этому навыку, чтобы закрепить достигнутый результат.",
    },
    errors: { road_block_unfinished: "Сначала заверши текущий блок", road_node_missing: "Занятие не найдено",
      road_theory_only: "Вручную можно отметить только чтение теории", road_not_unavailable: "Доступное занятие нельзя пропустить",
      road_block_archived: "Этот блок уже завершён. Открой текущий путь." },
  },
  kk: {
    title: "Менің оқу жолым", intro: "Нәтижелеріңе, қайталауларға және бағдарламаға сай келесі сабақтар.",
    focus: "Қазіргі мақсат", progress: "Блок барысы", continue: "Жолды жалғастыру", start: "Бастау",
    nextBlock: "Келесі блок", finished: "Блок аяқталды. Жаңа нәтижелер бойынша келесісін құрамыз.",
    policy: "Сабақтардың реті блок соңына дейін сақталады. Кез келген тақырыпты алдын ала ашуға болады.",
    why: "Неге ұсынылды?", mastery: "Игеру", insufficient: "Деректер жеткіліксіз",
    tasks: "тапсырма", minutes: "мин", prerequisite: "Алдымен бекіту ұсынылады", optional: "Бұл ұсыныс тақырыпқа кіруді шектемейді.",
    diagnostic: "Диагностиканы өту", diagnosticNote: "9 сұрақтан тұратын диагностика бастапқы бағытты таңдауға көмектеседі; қалған дағдыларды біртіндеп тексереміз.",
    empty: "Қазір қолжетімді сабақтар жоқ. Тақырып таңдауға немесе келесі қайталау кезінде оралуға болады.",
    loading: "Оқу жолы жүктелуде…", error: "Оқу жолын жүктеу мүмкін болмады. Қайталап көр.", reload: "Жаңарту",
    unavailable: "Өздік тексеруге жаңа тапсырма жоқ немесе қайталау басқа сабақта орындалған.",
    skip: "Осы тексерусіз жалғастыру", skipped: "Өткізілді: тексеру қолжетімсіз", participation: "Сабақты аяқтау орындалған жұмысты белгілейді. Игеру жауаптардың нәтижесімен анықталады.",
    passed: "Өздік тексеру сәтті өтті", failed: "Тексеру орындалды; дағдыны әлі бекіту қажет.",
    read: "Ережені оқыдым", back: "Оқу жолына оралу", invalidRequest: "Оқу жолының сұрауы дұрыс емес",
    types: { THEORY: "Теория", PRACTICE: "Жаттығу", REPAIR: "Бекіту", REVIEW: "Қайталау", CHECKPOINT: "Тексеру" },
    statuses: { COMPLETED: "Орындалды", CURRENT: "Қазір", UPCOMING: "Алда" },
    reasons: {
      weak: "Бұл дағды бойынша нәтиже мақсатты деңгейден төмен. Қысқа жаттығу оны бекітуге көмектеседі.",
      due: "Блок құрылған кезде жоспарланған 1/3/7/14 қайталау мерзімі келді.",
      coverage: "Бұл дағды әлі жеткілікті тексерілмеген. Деректер жинап, бағдарламаның қамтылуын кеңейтеміз.",
      evidence: "Сенімді бағалау үшін деректер әзірге жеткіліксіз. Осы дағды бойынша жаттығуды жалғастырамыз.",
      prerequisite: "Бұл негізгі дағды бағдарламада келесі сабақтардың біріне дайындық ретінде нақты көрсетілген.",
      checkpoint: "Сабақтардан кейін таңдалған дағдыны басқа тапсырмада көмексіз тексереміз.",
      freshness: "Блок құрылған кезде бұл дағды біраз уақыт қолданылмады. Қысқа жаттығумен жаңғыртамыз.",
      maintenance: "Қол жеткізілген нәтижені бекіту үшін осы дағды бойынша жаттығуды жалғастырамыз.",
    },
    errors: { road_block_unfinished: "Алдымен қазіргі блокты аяқта", road_node_missing: "Сабақ табылмады",
      road_theory_only: "Тек теорияны оқуды қолмен белгілеуге болады", road_not_unavailable: "Қолжетімді сабақты өткізуге болмайды",
      road_block_archived: "Бұл блок аяқталған. Қазіргі оқу жолын аш." },
  },
  en: {
    title: "Learning Road", intro: "Your next lessons, based on results, scheduled reviews and curriculum coverage.",
    focus: "Current focus", progress: "Block progress", continue: "Continue road", start: "Start",
    nextBlock: "Next block", finished: "Block complete. Build the next one from your latest results.",
    policy: "Lesson order stays stable until the block is complete. You can open any topic early.",
    why: "Why this lesson?", mastery: "Mastery", insufficient: "Insufficient evidence",
    tasks: "tasks", minutes: "min", prerequisite: "Recommended preparation", optional: "This recommendation does not restrict access.",
    diagnostic: "Take diagnostic", diagnosticNote: "The 9-question diagnostic gives an initial direction; other skills are assessed gradually.",
    empty: "No lessons are available right now. Choose a topic or return when your next review is due.",
    loading: "Loading road…", error: "Could not load your road. Please try again.", reload: "Reload",
    unavailable: "No fresh independent question is available, or this review was completed in another lesson.",
    skip: "Continue without this check", skipped: "Skipped: check unavailable", participation: "Completing a lesson records your work. Mastery is determined by your answers.",
    passed: "Independent check passed", failed: "Check completed; this skill needs more practice.",
    read: "I have read the rule", back: "Return to road", invalidRequest: "Invalid learning road request",
    types: { THEORY: "Theory", PRACTICE: "Practice", REPAIR: "Strengthen", REVIEW: "Review", CHECKPOINT: "Checkpoint" },
    statuses: { COMPLETED: "Completed", CURRENT: "Current", UPCOMING: "Upcoming" },
    reasons: {
      weak: "Results for this skill are below the target. Short practice can help strengthen it.",
      due: "A scheduled 1/3/7/14 review was due when this block was built.",
      coverage: "This skill has not been assessed sufficiently. Gather evidence and broaden curriculum coverage.",
      evidence: "There is not enough evidence for a confident assessment yet. Continue practising this skill.",
      prerequisite: "The curriculum explicitly lists this foundational skill as preparation for a later lesson.",
      checkpoint: "After the lessons, check the selected skill on a different question without help.",
      freshness: "This skill had not been practised recently when the block was built. Refresh it with short practice.",
      maintenance: "Continue practising this skill to consolidate your results.",
    },
    errors: { road_block_unfinished: "Complete the current block first", road_node_missing: "Lesson not found",
      road_theory_only: "Only reading theory can be marked manually", road_not_unavailable: "An available lesson cannot be skipped",
      road_block_archived: "This block is complete. Open your current road." },
  },
};
