"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TIPO_MATH } from "@/lib/exam/profile";
import { useAccount } from "@/components/providers/AccountProvider";

type Summary = { id: string; status: string; startedAt: string; points: number | null };
export default function ExamStartPage() {
  const { user } = useAccount(), router = useRouter();
  const [duration, setDuration] = useState(40), [history, setHistory] = useState<Summary[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<{ canGenerate: boolean; missing: string[] } | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([fetch("/api/exams", { cache: "no-store" }), fetch(`/api/exam-coverage?profile=${TIPO_MATH.id}`, { cache: "no-store" })])
      .then(async ([sessions, audit]) => {
        if (!sessions.ok || !audit.ok) throw new Error("Не удалось загрузить экзамены и проверить банк.");
        const saved = await sessions.json(), report = await audit.json();
        if (alive) { setHistory(saved); setAvailability({ canGenerate: report.readiness.balancedVariant.canGenerate,
          missing: report.readiness.balancedVariant.points.filter((p: { missingInPlan: number }) => p.missingInPlan)
            .map((p: { pointCode: string }) => `Пункт ${p.pointCode}: ${report.points.find((s: { code: string }) => s.code === p.pointCode).title}`) }); }
      }).catch((e) => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);
  async function start() {
    if (!user || busy) return;
    setBusy(true); setError("");
    const storageKey = `enttipo_exam_start_v1:${user.id}`;
    const settings = { profileId: TIPO_MATH.id, profileVersion: TIPO_MATH.version, language: "ru", durationMinutes: duration };
    let payload = { ...settings, requestId: crypto.randomUUID() };
    try {
      try {
        const old = localStorage.getItem(storageKey);
        if (old) { const parsed = JSON.parse(old); if (parsed.durationMinutes === duration) payload = parsed; }
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch { /* Server still serializes starts when storage is unavailable. */ }
      const res = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (res.status < 500) { try { localStorage.removeItem(storageKey); } catch {} } throw new Error(data.error); }
      try { localStorage.removeItem(storageKey); } catch {}
      router.push(`/exam/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Нет связи с сервером. Повторите запуск с теми же настройками."); }
    finally { setBusy(false); }
  }
  const active = history.find((h) => h.status === "active");
  return <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <h1 className="text-3xl font-bold">Экзамен · математический блок</h1>
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-semibold">Перед началом</h2>
      <p><strong>Профиль:</strong> {TIPO_MATH.title}</p>
      <p className="text-sm text-muted-foreground">{TIPO_MATH.id}@{TIPO_MATH.version}. {TIPO_MATH.audience}</p>
      <label className="block">Язык заданий <select className="ml-3 rounded border bg-background p-2" aria-label="Язык заданий" value="ru" disabled><option value="ru">Русский</option></select></label>
      <p className="text-sm text-muted-foreground">Для выбранного профиля проверен русский банк. Казахский вариант появится после проверки перевода; язык заданий не меняется во время экзамена.</p>
      <p><strong>Формат:</strong> 20 заданий, один правильный ответ из четырёх. Сложность A — 5, B — 10, C — 5.</p>
      <p><strong>Оценивание НЦТ:</strong> правильный ответ — 1 балл; неправильный ответ и пропуск — 0. Максимум — 20 баллов.</p>
      <label className="block font-medium">Учебный лимит платформы <select aria-label="Учебный лимит платформы" value={duration} disabled={busy || !!active} onChange={(e) => setDuration(Number(e.target.value))} className="ml-3 rounded border bg-background p-2">
        <option value={40}>40 минут</option><option value={30}>30 минут</option><option value={120}>120 минут</option>
      </select></label>
      <p className="text-sm text-muted-foreground">Официального отдельного лимита математики не найдено. 120 минут НЦТ относятся ко всему ЕНТ из двух дисциплин, 60 заданий. Выбранное здесь время — учебная настройка.</p>
      <p className="text-sm">По одному заданию на каждый из 20 пунктов — политика платформы из этапа 6.1. Официальные тематические квоты не опубликованы. Задания авторские, уровни сложности ещё не калиброваны на результатах учеников.</p>
      <p className="text-sm">Можно переходить между заданиями, менять ответы и отмечать «вернуться позже» до завершения. Время идёт по серверу, включая выход и потерю связи. Подсказки, AI и проверка ответа недоступны. Сохраняйте ответы при наличии сети; после срока новые ответы не принимаются.</p>
      <Link href="/exam-coverage" className="inline-block text-primary underline">Спецификация, источники и покрытие банка</Link>
      {availability && !availability.canGenerate && !active && <div role="alert" className="rounded border border-amber-500 p-3">Банк не позволяет собрать корректный полный вариант с квотами 5/10/5. {availability.missing.join("; ")} <Link href="/exam-coverage" className="underline">Подробности нехватки</Link></div>}
      {active ? <Button asChild><Link href={`/exam/${active.id}`}>Продолжить сохранённый экзамен</Link></Button> :
        <Button disabled={busy || loading || !availability?.canGenerate} onClick={start}>{busy ? "Создаём вариант…" : "Начать экзамен"}</Button>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Сохранённые экзамены</h2>
      {loading ? <p>Загрузка…</p> : !history.length ? <p className="text-muted-foreground">Здесь появятся ваши результаты.</p> : history.map((h) =>
        <Link key={h.id} href={`/exam/${h.id}`} className="flex justify-between rounded-lg border p-4 hover:bg-muted"><span>{new Date(h.startedAt).toLocaleString("ru-RU", { timeZone: "Asia/Qyzylorda" })}</span><span>{h.status === "active" ? "В процессе" : `${h.points}/20 баллов`}</span></Link>)}
    </section>
  </div>;
}
