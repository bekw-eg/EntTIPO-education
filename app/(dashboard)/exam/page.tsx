"use client";
import { Header } from "@/components/layout/Header";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TIPO_MATH } from "@/lib/exam/profile";
import { localizedExamProfile } from '@/lib/i18n/exam-content';
import { useAccount } from "@/components/providers/AccountProvider";

type Summary = { id: string; status: string; startedAt: string; points: number | null };
export default function ExamStartPage() {
  const { locale } = useLanguage();
  const profile = localizedExamProfile(TIPO_MATH, locale);
  const { user } = useAccount(), router = useRouter();
  const [duration, setDuration] = useState(40), [history, setHistory] = useState<Summary[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<{ canGenerate: boolean; missing: string[] } | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([fetch("/api/exams", { cache: "no-store" }), fetch(`/api/exam-coverage?profile=${TIPO_MATH.id}&language=${locale === 'kk' ? 'kk' : 'ru'}`, { cache: "no-store" })])
      .then(async ([sessions, audit]) => {
        if (!sessions.ok || !audit.ok) throw new Error(uiText("Не удалось загрузить экзамены и проверить банк.", locale));
        const saved = await sessions.json(), report = await audit.json();
        if (alive) { setHistory(saved); setAvailability({ canGenerate: report.readiness.balancedVariant.canGenerate,
          missing: report.readiness.balancedVariant.points.filter((p: { missingInPlan: number }) => p.missingInPlan)
            .map((p: { pointCode: string }) => uiText(`Пункт ${p.pointCode}: ${report.points.find((s: { code: string }) => s.code === p.pointCode).title}`, locale)) }); }
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
  return <><Header title={uiText("Экзамен · математический блок", locale)} /><div className="page-content reading-content">
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-xl font-semibold">{uiText("Перед началом", locale)}</h2>
      <p><strong>{uiText("Профиль:", locale)}</strong> {profile.title}</p>
      <p className="text-sm text-muted-foreground">{profile.audience}</p>
      <p>{uiText('Язык заданий', locale)}: <strong>{locale === 'kk' ? 'Қазақ тілі' : uiText('Русский', locale)}</strong></p>
      <p className="text-sm text-muted-foreground">{locale === 'kk' ? 'Тіл жоғарғы мәзірде таңдалады және емтихан басталғанда бекітіледі. Қазақша нұсқаға тек толық аударылған тапсырмалар кіреді.' : 'Язык выбирается в верхнем меню и фиксируется при запуске экзамена. В казахский вариант входят только полностью переведённые задания.'}</p>
      <p><strong>{uiText("Формат:", locale)}</strong> {uiText(" 20 заданий, один правильный ответ из четырёх. Сложность A — 5, B — 10, C — 5.", locale)}</p>
      <p><strong>{uiText("Оценивание НЦТ:", locale)}</strong> {uiText(" правильный ответ — 1 балл; неправильный ответ и пропуск — 0. Максимум — 20 баллов.", locale)}</p>
      <label className="block font-medium">{uiText("Учебный лимит платформы ", locale)}<select aria-label={uiText("Учебный лимит платформы", locale)} value={duration} disabled={busy || !!active} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 block rounded-md border bg-background p-2">
        <option value={40}>{uiText("40 минут", locale)}</option><option value={30}>{uiText("30 минут", locale)}</option><option value={120}>{uiText("120 минут", locale)}</option>
      </select></label>
      <p className="text-sm text-muted-foreground">{uiText("Официального отдельного лимита математики не найдено. 120 минут НЦТ относятся ко всему ЕНТ из двух дисциплин, 60 заданий. Выбранное здесь время — учебная настройка.", locale)}</p>
      <details className="text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">{uiText("Спецификация, источники и покрытие банка", locale)}</summary><div className="space-y-3 pt-3"><p className="text-sm">{uiText("По одному заданию на каждый из 20 пунктов — политика платформы из этапа 6.1. Официальные тематические квоты не опубликованы. Задания авторские, уровни сложности ещё не калиброваны на результатах учеников.", locale)}</p>
      <p className="text-sm">{uiText("Можно переходить между заданиями, менять ответы и отмечать «вернуться позже» до завершения. Время идёт по серверу, включая выход и потерю связи. Подсказки, AI и проверка ответа недоступны. Сохраняйте ответы при наличии сети; после срока новые ответы не принимаются.", locale)}</p>
      <Link href="/exam-coverage" className="inline-block text-primary underline">{uiText("Спецификация, источники и покрытие банка", locale)}</Link></div></details>
      {availability && !availability.canGenerate && !active && <div role="alert" className="rounded border border-amber-500 p-3">{uiText("Банк не позволяет собрать корректный полный вариант с квотами 5/10/5. ", locale)}{availability.missing.join("; ")} <Link href="/exam-coverage" className="underline">{uiText("Подробности нехватки", locale)}</Link></div>}
      {active ? <Button asChild><Link href={`/exam/${active.id}`}>{uiText("Продолжить сохранённый экзамен", locale)}</Link></Button> :
        <Button disabled={busy || loading || !availability?.canGenerate} onClick={start}>{busy ? uiText("Создаём вариант…", locale) : uiText("Начать экзамен", locale)}</Button>}
      {error && <p role="alert" className="text-red-600">{errorText(error, locale)}</p>}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">{uiText("Сохранённые экзамены", locale)}</h2>
      {loading ? <p>{uiText("Загрузка…", locale)}</p> : !history.length ? <p className="text-muted-foreground">{uiText("Здесь появятся ваши результаты.", locale)}</p> : history.map((h) =>
        <Link key={h.id} href={`/exam/${h.id}`} className="flex justify-between rounded-lg border p-4 hover:bg-muted"><span>{new Date(h.startedAt).toLocaleString("ru-RU", { timeZone: "Asia/Qyzylorda" })}</span><span>{h.status === "active" ? uiText("В процессе", locale) : uiText(`${h.points}/20 баллов`, locale)}</span></Link>)}
    </section>
  </div></>;
}
