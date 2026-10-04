import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageUserId } from "@/lib/user";
import { EXAM_PROFILES, getExamProfile, TIPO_MATH } from "@/lib/exam/profile";
import { readCoverage } from "@/lib/exam/database";

export const dynamic = "force-dynamic";
export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  await requirePageUserId();
  const profile = getExamProfile((await searchParams).profile ?? TIPO_MATH.id);
  if (!profile) notFound();
  const report = await readCoverage(prisma, profile);
  const { totals, points, questions, readiness } = report;
  const labels = { uncovered: "Не покрыто", thin: "Мало разнообразия", represented: "Есть разнообразие" };
  const issues = questions.filter((q) => q.quality === "needs_review" || q.missingSkills.length > 0);
  const outside = questions.filter((q) => q.quality === "outside");
  return <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
    <div><h1 className="text-2xl font-bold">Соответствие экзамену и покрытие банка</h1>
      <p className="text-muted-foreground mt-2">Проверка фактических задач, форматов и разнообразия. Полное соответствие пока не подтверждено.</p></div>
    <form className="flex flex-wrap gap-3 items-end">
      <label className="flex-1 min-w-0">Экзаменационный профиль
        <select name="profile" defaultValue={profile.id} className="block w-full rounded border bg-background p-2 mt-1">
          {EXAM_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select></label>
      <button className="rounded bg-primary text-primary-foreground px-4 py-2">Проверить</button>
      <a href={`/api/exam-coverage?profile=${encodeURIComponent(profile.id)}`} className="underline p-2">Скачать JSON</a>
    </form>
    <section className="rounded-xl border p-5 space-y-3">
      <h2 className="font-semibold text-lg">{profile.title}</h2>
      <p>{profile.audience}</p><p className="text-sm text-muted-foreground">{profile.applicability}</p>
      <p className="text-sm">Версия данных {profile.version} · Источники проверены {profile.checkedAt}</p>
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <p><strong>{profile.official.questionCount} заданий / {profile.official.maxPoints} баллов</strong><br />Один правильный ответ из четырёх; верный — {profile.official.correctPoints} балл, неверный — {profile.official.incorrectPoints}.</p>
        <p><strong>A: {profile.official.difficultyCounts.A} · B: {profile.official.difficultyCounts.B} · C: {profile.official.difficultyCounts.C}</strong><br />Уровни задач назначены содержательной проверкой; статистическая калибровка остаётся.</p>
        <p><strong>{profile.official.wholeExamMinutes} минут на весь ЕНТ ТиПО</strong><br />{profile.official.mathBlockMinutes === null ? "Отдельный лимит математики не установлен в проверенных документах." : `Лимит блока: ${profile.official.mathBlockMinutes} минут.`} Среднее время задания: {profile.official.averageTaskMinutes.join("–")} минуты.</p>
      </div>
      <details><summary className="cursor-pointer underline">Официальные источники</summary>
        <ul className="list-disc pl-5 mt-3 space-y-2">{profile.sources.map((s) => <li key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a>
          <p className="text-sm text-muted-foreground">{s.locator}</p>
          {s.snapshotUrl && <a href={s.snapshotUrl} target="_blank" rel="noreferrer" className="text-sm underline">Сохранённый оригинал PDF на дату проверки</a>}</li>)}</ul>
      </details>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["Задач в базе", totals.databaseQuestions], ["Прямое соответствие содержания", totals.direct],
        ["Пригодны по формату и уровню", totals.uniqueEligible], ["Требуют проверки", totals.needsReview]].map(([label, value]) =>
        <div key={label} className="border rounded-xl p-4"><div className="text-2xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>)}
    </div>
    <p className="text-sm">Без прямого покрытия: {totals.uncoveredPoints} из {points.length} пунктов. Без пригодного экзаменационного формата: {totals.missingFormatPoints}.
      Вспомогательная практика: {totals.supporting}; вне профиля: {totals.outside}; несоответствие метки темы содержанию: {totals.topicMismatches}.
      Учебные шаги с выбором ответа не считаются целым экзаменационным заданием.</p>
    {report.sections.filter((s) => s.status === "uncovered").map((s) => <p key={s.section} className="rounded border border-red-500/40 p-3 text-red-700 dark:text-red-400">Раздел без прямого покрытия: {s.section} (пункты {s.pointCodes.join(", ")}).</p>)}
    <section className="border rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold">Хватит ли банка на варианты?</h2>
      {[readiness.oneVariant, readiness.multipleVariants, readiness.balancedVariant].map((r) => <div key={`${r.variants}-${r.balanced}`} className="border-l-4 border-primary pl-3">
        <p className="font-medium">{r.balanced ? "Вариант с внутренним балансом тем" : `Вариантов: ${r.variants}`} — {r.canGenerate ? "можно подобрать по указанным ограничениям" : `не хватает ${r.shortage} заданий`}</p>
        <p className="text-sm text-muted-foreground">{r.constraints}</p>
        <p className="text-sm">{r.difficulty.map((d) => `${d.band}: требуется ${d.required}, семейств ${d.availableFamilies}`).join(" · ")}</p>
      </div>)}
      <p className="text-sm text-muted-foreground">Это проверка доступности для будущего генератора, не готовый экзамен. Возможность подбора по формату и сложности не доказывает полноту тематического покрытия.</p>
    </section>
    <section><h2 className="text-lg font-semibold mb-3">Пункты спецификации</h2>
      <p className="text-sm text-muted-foreground mb-3">«Есть разнообразие» означает наличие минимум {profile.platformPolicy.minFamiliesPerPoint} семейств решения. Это внутренний порог, а не подтверждение исчерпывающего покрытия пункта НЦТ. Нажмите строку задач, чтобы проверить состав и границы соответствия.</p>
      <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm text-left">
        <thead className="bg-muted"><tr>{["Пункт", "Содержание / задачи", "Прямые / семейства", "Вспомогательные", "Экзамен A / B / C", "Состояние"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{points.map((p) => <tr key={p.code} className="border-t align-top">
          <td className="p-3">{p.code}</td><td className="p-3 min-w-72"><p className="text-xs text-muted-foreground">{p.section}</p><p className="font-medium">{p.title}</p>
            <details className="mt-2"><summary className="cursor-pointer underline">Задачи: {p.total}</summary>
              <ul className="mt-2 space-y-3">{questions.filter((q) => q.pointCode === p.code).map((q) => <li key={q.id}>
                <Link className="underline" href={`/topics/${q.topicId}`}>{q.title}</Link>
                <p className="text-xs break-all">{q.id}</p><p className="text-sm whitespace-pre-wrap">{q.questionText}</p>{q.latex && <p className="text-xs break-all">{q.latex}</p>}<p className="text-xs">{q.rationale}</p>
                <p className="text-xs text-muted-foreground">{q.eligible ? "Пригодна для подбора" : "Не включается в подбор экзамена"}{q.topicMismatch ? " · Неверная метка темы" : ""}</p>
              </li>)}</ul>
            </details></td>
          <td className="p-3">{p.direct} / {p.families}</td><td className="p-3">{p.supporting}</td>
          <td className="p-3">{p.difficulty.A} / {p.difficulty.B} / {p.difficulty.C}{p.missingFormat && <p className="text-amber-700 dark:text-amber-400 mt-1">Формат отсутствует</p>}</td>
          <td className={`p-3 font-medium ${p.status === "uncovered" ? "text-red-600 dark:text-red-400" : ""}`}>{labels[p.status as keyof typeof labels]}</td>
        </tr>)}</tbody></table></div>
    </section>
    <section className="border rounded-xl p-5 space-y-4"><h2 className="text-lg font-semibold">Оставшиеся проверки</h2>
      <details><summary className="cursor-pointer">Проверка содержания и навыков: {issues.length}</summary>
        <ul className="mt-3 space-y-2">{issues.map((q) => <li key={q.id} className="text-sm"><strong>{q.title}</strong> <span className="break-all text-xs">({q.id})</span><p>{q.rationale}</p>{q.missingSkills.length > 0 && <p>Нет сохранённой связи с навыками: {q.missingSkills.join(", ")}</p>}</li>)}</ul>
      </details>
      <details><summary className="cursor-pointer">Задачи вне профиля: {outside.length}</summary>
        <ul className="mt-3 space-y-2">{outside.map((q) => <li key={q.id} className="text-sm"><strong>{q.title}</strong> <span className="text-xs">({q.id})</span><p>{q.rationale}</p></li>)}</ul>
      </details>
      <p className="text-sm">Групп точных копий содержания: {report.duplicateGroups.length}. Замена коэффициентов внутри одного семейства не увеличивает число разных способов решения.</p>
      <p className="text-sm text-muted-foreground">Не завершены все навыки внутри широких пунктов, калибровка сложности и переводы новых заданий на казахский. Для полного экзамена B057 также нужна специальная дисциплина «Основы алгоритмизации и программирования».</p>
    </section>
  </div>;
}
