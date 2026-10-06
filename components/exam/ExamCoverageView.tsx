"use client";
import { Header } from "@/components/layout/Header";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { uiText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";


import Link from "next/link";
import { EXAM_PROFILES } from "@/lib/exam/profile";
import type { CoverageReport } from "@/lib/exam/coverage";
import { localizedExamProfile } from "@/lib/i18n/exam-content";
import { contentText } from "@/lib/i18n/content";
import { MathText } from "@/components/ui/MathText";

export default function ExamCoverageView({ reportRu, reportKk }: { reportRu: CoverageReport; reportKk: CoverageReport }) {
  const { locale } = useLanguage();
  const report = locale === "kk" ? reportKk : reportRu;
  const profile = localizedExamProfile(report.profile, locale);
  const { totals, questions, readiness } = report;
  const points = report.points.map((p) => ({ ...p, ...profile.points.find((point) => point.code === p.code) }));
  const labels = { uncovered: uiText("Не покрыто", locale), thin: uiText("Мало разнообразия", locale), represented: uiText("Есть разнообразие", locale) };
  const issues = questions.filter((q) => q.quality === "needs_review" || q.missingSkills.length > 0 || q.missingTranslations.length > 0);
  const outside = questions.filter((q) => q.quality === "outside");
  return <><Header title={uiText("Соответствие экзамену и покрытие банка", locale)} subtitle={uiText("Проверка фактических задач, форматов и разнообразия. Полное соответствие пока не подтверждено.", locale)} /><div className="page-content">
    <form className="flex flex-wrap gap-3 items-end">
      <label className="flex-1 min-w-0">{uiText("Экзаменационный профиль ", locale)}<select name="profile" defaultValue={profile.id} className="block w-full rounded border bg-background p-2 mt-1">
          {EXAM_PROFILES.map((p) => <option key={p.id} value={p.id}>{localizedExamProfile(p, locale).title}</option>)}
        </select></label>
      <button className="rounded bg-primary text-primary-foreground px-4 py-2">{uiText("Проверить", locale)}</button>
      <a href={`/api/exam-coverage?profile=${encodeURIComponent(profile.id)}&language=${locale === "kk" ? "kk" : "ru"}`} className="underline p-2">{uiText("Скачать JSON", locale)}</a>
    </form>
    <section className="rounded-xl border p-5 space-y-3">
      <h2 className="font-semibold text-lg">{profile.title}</h2>
      <p>{profile.audience}</p><p className="text-sm text-muted-foreground">{profile.applicability}</p>
      <p className="text-sm">{uiText("Версия данных ", locale)}{profile.version} {uiText(" · Источники проверены ", locale)}{profile.checkedAt}</p>
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <p><strong>{profile.official.questionCount} {uiText(" заданий / ", locale)}{profile.official.maxPoints} {uiText(" баллов", locale)}</strong><br />{uiText("Один правильный ответ из четырёх; верный — ", locale)}{profile.official.correctPoints} {uiText(" балл, неверный — ", locale)}{profile.official.incorrectPoints}.</p>
        <p><strong>A: {profile.official.difficultyCounts.A} · B: {profile.official.difficultyCounts.B} · C: {profile.official.difficultyCounts.C}</strong><br />{uiText("Уровни задач назначены содержательной проверкой; статистическая калибровка остаётся.", locale)}</p>
        <p><strong>{profile.official.wholeExamMinutes} {uiText(" минут на весь ЕНТ ТиПО", locale)}</strong><br />{profile.official.mathBlockMinutes === null ? uiText("Отдельный лимит математики не установлен в проверенных документах.", locale) : uiText(`Лимит блока: ${profile.official.mathBlockMinutes} минут.`, locale)} {uiText(" Среднее время задания: ", locale)}{profile.official.averageTaskMinutes.join("–")} {uiText(" минуты.", locale)}</p>
      </div>
      <details><summary className="cursor-pointer underline">{uiText("Официальные источники", locale)}</summary>
        <ul className="list-disc pl-5 mt-3 space-y-2">{profile.sources.map((s) => <li key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a>
          <p className="text-sm text-muted-foreground">{s.locator}</p>
          {s.snapshotUrl && <a href={s.snapshotUrl} target="_blank" rel="noreferrer" className="text-sm underline">{uiText("Сохранённый оригинал PDF на дату проверки", locale)}</a>}</li>)}</ul>
      </details>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[[uiText("Задач в базе", locale), totals.databaseQuestions], [uiText("Прямое соответствие содержания", locale), totals.direct],
        [uiText("Пригодны по формату и уровню", locale), totals.uniqueEligible], [uiText("Требуют проверки", locale), totals.needsReview]].map(([label, value]) =>
        <div key={label} className="border rounded-xl p-4"><div className="text-2xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>)}
    </div>
    <p className="text-sm">{uiText("Без прямого покрытия: ", locale)}{totals.uncoveredPoints} {uiText(" из ", locale)}{points.length} {uiText(" пунктов. Без пригодного экзаменационного формата: ", locale)}{totals.missingFormatPoints}{uiText(". Вспомогательная практика: ", locale)}{totals.supporting}{uiText("; вне профиля: ", locale)}{totals.outside}{uiText("; несоответствие метки темы содержанию: ", locale)}{totals.topicMismatches}{uiText(". Учебные шаги с выбором ответа не считаются целым экзаменационным заданием.", locale)}</p>
    {report.sections.filter((s) => s.status === "uncovered").map((s) => <p key={profile.points.find((p) => s.pointCodes.includes(p.code))?.section ?? s.section} className="rounded border border-red-500/40 p-3 text-red-700 dark:text-red-400">{uiText("Раздел без прямого покрытия: ", locale)}{s.section} {uiText(" (пункты ", locale)}{s.pointCodes.join(", ")}).</p>)}
    <section className="border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold">{uiText("Хватит ли банка на варианты?", locale)}</h2>
      {[readiness.oneVariant, readiness.multipleVariants, readiness.balancedVariant].map((r) => <div key={`${r.variants}-${r.balanced}`} className="border-l-4 border-primary pl-3">
        <p className="font-medium">{r.balanced ? uiText("Вариант с внутренним балансом тем", locale) : uiText(`Вариантов: ${r.variants}`, locale)} — {r.canGenerate ? uiText("можно подобрать по указанным ограничениям", locale) : uiText(`не хватает ${r.shortage} заданий`, locale)}</p>
        <p className="text-sm text-muted-foreground">{uiText(r.constraints, locale)}</p>
        <p className="text-sm">{r.difficulty.map((d) => uiText(`${d.band}: требуется ${d.required}, семейств ${d.availableFamilies}`, locale)).join(" · ")}</p>
      </div>)}
      <p className="text-sm text-muted-foreground">{uiText("Экзаменационный режим использует квоты A/B/C и внутренний баланс тем. Возможность подбора не доказывает исчерпывающее покрытие каждого пункта.", locale)}</p>
      <Link className="inline-block text-primary underline" href="/exam">{uiText("Перейти к экзамену по подтверждённому профилю", locale)}</Link>
    </section>
    <section><h2 className="text-lg font-semibold mb-3">{uiText("Пункты спецификации", locale)}</h2>
      <p className="text-sm text-muted-foreground mb-3">{uiText("«Есть разнообразие» означает наличие минимум ", locale)}{profile.platformPolicy.minFamiliesPerPoint} {uiText(" семейств решения. Это внутренний порог, а не подтверждение исчерпывающего покрытия пункта НЦТ. Нажмите строку задач, чтобы проверить состав и границы соответствия.", locale)}</p>
      <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm text-left">
        <thead className="bg-muted"><tr>{[uiText("Пункт", locale), uiText("Содержание / задачи", locale), uiText("Прямые / семейства", locale), uiText("Вспомогательные", locale), uiText("Экзамен A / B / C", locale), uiText("Состояние", locale)].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{points.map((p) => <tr key={p.code} className="border-t align-top">
          <td className="p-3">{p.code}</td><td className="p-3 min-w-72"><p className="text-xs text-muted-foreground">{p.section}</p><p className="font-medium">{p.title}</p>
            <details className="mt-2"><summary className="cursor-pointer underline">{uiText("Задачи: ", locale)}{p.total}</summary>
              <ul className="mt-2 space-y-3">{questions.filter((q) => q.pointCode === p.code).map((q) => <li key={q.id}>
                <Link className="underline" href={`/topics/${q.topicId}`}>{contentText(q.title, q.titleKk, locale)}</Link>
                <p className="text-xs break-all">{q.id}</p><MathText content={contentText(q.questionText.replace(/\[GEOMETRY:[\s\S]*?\]/g, ""), q.questionTextKk?.replace(/\[GEOMETRY:[\s\S]*?\]/g, ""), locale)} />{q.latex && !q.latex.includes("[GEOMETRY:") && <MathDisplay math={q.latex} block />}<p className="text-xs">{locale === "kk" ? ({ direct: "Мазмұны спецификацияға сәйкес; пішімі, деңгейі және аудармасы бойынша жарамдылық бөлек тексеріледі.", supporting: "Қосымша оқу практикасы; емтихан тапсырмасына тікелей сәйкес емес.", outside: "Тапсырма мазмұны осы профильден тыс.", needs_review: "Ағымдағы мазмұн үшін тексеру жоқ немесе тексеруден кейін мазмұн өзгерген." }[q.quality]) : q.rationale}</p>
                <p className="text-xs text-muted-foreground">{q.eligible ? uiText("Пригодна для подбора", locale) : uiText("Не включается в подбор экзамена", locale)}{q.topicMismatch ? uiText(" · Неверная метка темы", locale) : ""}</p>
              </li>)}</ul>
            </details></td>
          <td className="p-3">{p.direct} / {p.families}</td><td className="p-3">{p.supporting}</td>
          <td className="p-3">{p.difficulty.A} / {p.difficulty.B} / {p.difficulty.C}{p.missingFormat && <p className="text-amber-700 dark:text-amber-400 mt-1">{uiText("Формат отсутствует", locale)}</p>}</td>
          <td className={`p-3 font-medium ${p.status === "uncovered" ? "text-red-600 dark:text-red-400" : ""}`}>{labels[p.status as keyof typeof labels]}</td>
        </tr>)}</tbody></table></div>
    </section>
    <section className="border rounded-xl p-5 space-y-4"><h2 className="text-lg font-semibold">{uiText("Оставшиеся проверки", locale)}</h2>
      <details><summary className="cursor-pointer">{uiText("Проверка содержания и навыков: ", locale)}{issues.length}</summary>
        <ul className="mt-3 space-y-2">{issues.map((q) => <li key={q.id} className="text-sm"><strong>{contentText(q.title, q.titleKk, locale)}</strong> <span className="break-all text-xs">({q.id})</span><p>{locale === "kk" ? ({ direct: "Мазмұны спецификацияға сәйкес; пішімі, деңгейі және аудармасы бойынша жарамдылық бөлек тексеріледі.", supporting: "Қосымша оқу практикасы; емтихан тапсырмасына тікелей сәйкес емес.", outside: "Тапсырма мазмұны осы профильден тыс.", needs_review: "Ағымдағы мазмұн үшін тексеру жоқ немесе тексеруден кейін мазмұн өзгерген." }[q.quality]) : q.rationale}</p>{q.missingTranslations.length > 0 && <p>{locale === "kk" ? "Қазақша аудармасы толық емес; қазақша нұсқаға қосылмайды." : uiText("Казахский перевод неполон; в казахский вариант не включается.", locale)} {q.missingTranslations.join(", ")}</p>}{q.missingSkills.length > 0 && <p>{uiText("Нет сохранённой связи с навыками: ", locale)}{q.missingSkills.join(", ")}</p>}</li>)}</ul>
      </details>
      <details><summary className="cursor-pointer">{uiText("Задачи вне профиля: ", locale)}{outside.length}</summary>
        <ul className="mt-3 space-y-2">{outside.map((q) => <li key={q.id} className="text-sm"><strong>{contentText(q.title, q.titleKk, locale)}</strong> <span className="text-xs">({q.id})</span><p>{locale === "kk" ? ({ direct: "Мазмұны спецификацияға сәйкес; пішімі, деңгейі және аудармасы бойынша жарамдылық бөлек тексеріледі.", supporting: "Қосымша оқу практикасы; емтихан тапсырмасына тікелей сәйкес емес.", outside: "Тапсырма мазмұны осы профильден тыс.", needs_review: "Ағымдағы мазмұн үшін тексеру жоқ немесе тексеруден кейін мазмұн өзгерген." }[q.quality]) : q.rationale}</p></li>)}</ul>
      </details>
      <p className="text-sm">{uiText("Групп точных копий содержания: ", locale)}{report.duplicateGroups.length}{uiText(". Замена коэффициентов внутри одного семейства не увеличивает число разных способов решения.", locale)}</p>
      <p className="text-sm text-muted-foreground">{uiText("Не завершены все навыки внутри широких пунктов и калибровка сложности. Для полного экзамена B057 также нужна специальная дисциплина «Основы алгоритмизации и программирования».", locale)}</p>
    </section>
  </div></>;
}
