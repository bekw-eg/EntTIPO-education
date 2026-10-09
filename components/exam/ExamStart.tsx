"use client";
import { Header } from "@/components/layout/Header";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TIPO_MATH } from "@/lib/exam/profile";
import { useAccount } from "@/components/providers/AccountProvider";

type Summary = { id: string; status: string; startedAt: string; points: number | null };
export function ExamStart() {
  const { locale } = useLanguage();
  const { user } = useAccount(), router = useRouter();
  const [duration, setDuration] = useState(40), [history, setHistory] = useState<Summary[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<{ canGenerate: boolean; missing: string[] } | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([fetch("/api/exams", { cache: "no-store" }), fetch("/api/exams/availability", { cache: "no-store" })])
      .then(async ([sessions, audit]) => {
        if (!sessions.ok || !audit.ok) throw new Error(uiText("Не удалось загрузить экзамены и проверить банк.", locale));
        const saved = await sessions.json(), report = await audit.json();
        const language = report.languages.find((item: { language: string }) => item.language === (locale === 'kk' ? 'kk' : 'ru'));
        if (alive) { setHistory(saved); setAvailability({ canGenerate: !!language?.canGenerate,
          missing: language?.missingPointCodes.map((code: string) => code) ?? [] }); }
      }).catch((e) => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, locale]);
  async function start() {
    if (!user || busy) return;
    setBusy(true); setError("");
    const storageKey = `enttipo_exam_start_v1:${user.id}`;
    const settings = { profileId: TIPO_MATH.id, profileVersion: TIPO_MATH.version, language: locale === 'kk' ? 'kk' : 'ru', durationMinutes: duration };
    let payload = { ...settings, requestId: crypto.randomUUID() };
    try {
      try {
        const old = localStorage.getItem(storageKey);
        if (old) { const parsed = JSON.parse(old); if (parsed.durationMinutes === duration && parsed.language === settings.language) payload = parsed; }
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch { /* Server still serializes starts when storage is unavailable. */ }
      const res = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (res.status < 500) { try { localStorage.removeItem(storageKey); } catch {} } throw new Error(data.error); }
      try { localStorage.removeItem(storageKey); } catch {}
      router.push(`/exam/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : uiText("Нет связи с сервером. Повторите запуск с теми же настройками.", locale)); }
    finally { setBusy(false); }
  }
  const active = history.find((h) => h.status === "active");
  const kk = locale === 'kk';
  return <><Header title={kk ? "Математика сынағы" : "Пробник по математике"}
    subtitle={kk ? "ТжКБ ҰБТ · B057 · қысқартылған оқу мерзімі" : "ЕНТ ТиПО · B057 · сокращённый срок обучения"} />
    <div className="page-content reading-content">
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold">{kk ? "Сынақ алдында" : "Перед началом"}</h2>
        <p>{kk ? "Колледж түлектеріне арналған математика, B057 «Ақпараттық технологиялар», қысқартылған оқу мерзімі." : "Математика для выпускников колледжей: B057 «Информационные технологии», сокращённый срок обучения."}</p>
        <p>{kk ? "20 тапсырма · төрт нұсқаның біреуі дұрыс · ең көбі 20 балл." : "20 заданий · один правильный ответ из четырёх · максимум 20 баллов."}</p>
        <p className="text-sm text-muted-foreground">{kk ? "Дұрыс жауап — 1 балл, қате жауап пен өткізіп кеткен тапсырма — 0." : "Правильный ответ — 1 балл, ошибка и пропуск — 0."}</p>
        <p>{kk ? "Тапсырмалар тілі: қазақша" : "Язык заданий: русский"}</p>
        <label className="block font-medium">{kk ? "Оқу үшін уақыт шектеуі" : "Учебный лимит времени"}
          <select aria-label={kk ? "Оқу үшін уақыт шектеуі" : "Учебный лимит времени"} value={duration} disabled={busy || !!active}
            onChange={event => setDuration(Number(event.target.value))} className="mt-2 block rounded-md border bg-background p-2">
            {[30, 40, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} {kk ? "минут" : "минут"}</option>)}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">{kk ? "Бұл Synaq оқу баптауы, ҰБТ-ның ресми уақыт нормативі емес." : "Это учебная настройка Synaq, а не официальный норматив времени ЕНТ."}</p>
        {availability && !availability.canGenerate && !active && <div role="alert" className="rounded border border-amber-500 p-3">
          {kk ? "Бұл тілде жаңа толық сынаққа тапсырмалар жеткіліксіз. Бұрын берілген тапсырмалар қайталанбайды. Сақталған нәтижелерді ашуға болады." : "Для нового полного пробника на этом языке недостаточно неиспользованных заданий. Прежние задания не повторяются. Сохранённые результаты доступны."}
          {!!availability.missing.length && <p>{kk ? "Тармақтар: " : "Пункты: "}{availability.missing.join(', ')}</p>}
        </div>}
        {active ? <Button asChild><Link href={`/exam/${active.id}`}>{kk ? "Сақталған сынақты жалғастыру" : "Продолжить пробник"}</Link></Button> :
          <Button disabled={busy || loading || !availability?.canGenerate} onClick={start}>{busy ? (kk ? "Нұсқа жасалуда…" : "Создаём вариант…") : (kk ? "Сынақты бастау" : "Начать пробник")}</Button>}
        <details className="text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">{kk ? "Сынақ қалай өтеді" : "Как проходит пробник"}</summary><div className="space-y-3 pt-3">
        <p className="text-sm text-muted-foreground">{kk ? "Тілді жоғарғы мәзірде таңдаңыз. Басталған сынақтың тілі сақталады." : "Выберите язык в верхнем меню. Язык начатой попытки сохраняется."}</p>
        <p className="text-sm text-muted-foreground">{kk ? "Тапсырмалар арасында өтіп, жауаптарды өзгертіп, кейін оралу үшін белгілей аласыз. Жауаптар желі арқылы автоматты сақталады. Уақыт сайттан шыққанда да жалғасады. Жауаптар мен шешімдер аяқтағаннан кейін ашылады." : "Можно переходить между заданиями, менять ответы и отмечать «вернуться». Ответы автоматически сохраняются при наличии сети. Время идёт и после выхода с сайта. Правильные ответы и решения откроются после завершения."}</p>
        <p className="text-sm text-muted-foreground">{kk ? "Тапсырмалар авторлық. Жаңа сынақтарда бұрын берілген есептер қайталанбайды, тілді ауыстыру да бұл ережені өзгертпейді. Ұқсас үлгілер кездесуі мүмкін. Қор таусылғанда жаңа сынақ жасау тоқтайды; тарих автоматты түрде өшірілмейді." : "Задания авторские. Новые пробники исключают все ранее выданные вам задачи, в том числе при смене языка. Похожие шаблоны могут встречаться. Когда новых заданий не хватит, создание пробника остановится; история автоматически не сбрасывается."}</p>
        </div></details>
        {error && <p role="alert" className="text-red-600">{errorText(error, locale)}</p>}
        {error && <Button variant="outline" onClick={() => window.location.reload()}>{kk ? "Қайта жүктеу" : "Повторить загрузку"}</Button>}
      </section>
      <Link href="/results" className="inline-flex min-h-11 items-center text-primary underline">{kk ? "Менің нәтижелерім" : "Мои результаты"}</Link>
    </div></>;
}
