"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/ui/MathText";
import { useAccount } from "@/components/providers/AccountProvider";
import { backupExamSave, recoverExamSave, examDisplaySeconds, type PendingExamSave } from "@/lib/client-exam";
import type { ExamProfile } from "@/lib/exam/profile";
import type { gradeExamQuestion, publicExamQuestion } from "@/lib/exam/mode";

type GradedQuestion = ReturnType<typeof gradeExamQuestion>;
type Report = { points: number; maxPoints: number; skipped: number; masteryPolicy: string; completionReason: string;
  topics: { topicId: string; name: string; points: number; maxPoints: number; skipped: number }[];
  skills: { skillId: string; name: string; points: number; maxPoints: number; masteryScore: number | null; state: string }[];
  questions: GradedQuestion[]; gaps: { questionId: string; title: string; reason: string; action: string; ruleHref: string; practiceHref: string }[];
  previouslyExposedCount: number };
type Snapshot = { id: string; status: string; profile: ExamProfile; language: string; durationMinutes: number;
  startedAt: string; deadlineAt: string; serverNow: string; remainingSeconds: number; revision: number; currentIndex: number;
  questions: ReturnType<typeof publicExamQuestion>[]; answers: Record<string, number>; flaggedQuestionIds: string[]; result: Report | null };
export default function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params), { user } = useAccount();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false), [seconds, setSeconds] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const finishRequested = useRef(false);
  const state = useRef<Snapshot | null>(null), operation = useRef<PendingExamSave | null>(null), working = useRef(false);
  const clock = useRef({ remaining: 0, received: 0 });
  const apply = useCallback((data: Snapshot) => {
    if (state.current && (data.revision < state.current.revision ||
      (data.revision === state.current.revision && data.serverNow < state.current.serverNow))) return;
    state.current = data; setSnapshot(data);
    clock.current = { remaining: data.remainingSeconds, received: performance.now() }; setSeconds(data.remainingSeconds);
    if (data.status === "completed") {
      operation.current = null; setPending(false);
      if (user) backupExamSave(user.id, examId, null);
    }
  }, [examId, user]);
  const read = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}`, { cache: "no-store" }), data = await res.json();
    if (!res.ok) throw new Error(data.error);
    apply(data); return data as Snapshot;
  }, [apply, examId]);
  const sendPending = useCallback(async () => {
    if (!operation.current) return;
    const res = await fetch(`/api/exams/${examId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation.current) });
    const data = await res.json();
    if (res.status === 409) {
      throw new Error("Состояние изменилось в другой вкладке. Загрузите серверную версию, затем повторите нужный ответ.");
    }
    if (!res.ok) throw new Error(data.error);
    operation.current = null; setPending(false); if (user) backupExamSave(user.id, examId, null); apply(data);
  }, [apply, examId, user]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void read().then((data) => {
      if (!alive || data.status !== "active") return;
      const saved = recoverExamSave(user.id, examId);
      if (saved) { operation.current = saved; setPending(true); setError("Есть неподтверждённое сохранение. Повторите запрос до завершения времени."); }
    }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [examId, user, read]);
  useEffect(() => {
    const refresh = () => {
      if (state.current?.status !== "active" || working.current || document.visibilityState !== "visible") return;
      void read().catch(() => setError("Нет связи с сервером. Время продолжает идти. Повторите сохранение или обновите состояние."));
    };
    const tick = window.setInterval(() => {
      if (state.current?.status !== "active") return;
      const left = examDisplaySeconds(clock.current.remaining, clock.current.received, performance.now());
      setSeconds(left);
    }, 250);
    const poll = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const leave = (event: BeforeUnloadEvent) => { if (operation.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", leave);
    return () => { clearInterval(tick); clearInterval(poll); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("beforeunload", leave); };
  }, [read]);
  useEffect(() => {
    if (snapshot?.status === "active" && seconds === 0 && !working.current) {
      void read().catch(() => setError("Время истекло. Восстановите связь, чтобы получить сохранённый результат."));
    }
  }, [seconds, snapshot?.status, read]);
  useEffect(() => { if (snapshot?.status === "completed") window.scrollTo({ top: 0 }); }, [snapshot?.status]);
  async function run(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Нет связи с сервером. Повторите запрос."); }
    finally { working.current = false; setBusy(false); }
  }
  function change(values: Partial<Pick<PendingExamSave, "answers" | "currentIndex" | "flaggedQuestionIds">>) {
    const data = state.current;
    if (!data || data.status !== "active" || operation.current || working.current) return;
    operation.current = { requestId: crypto.randomUUID(), revision: data.revision, answers: data.answers,
      currentIndex: data.currentIndex, flaggedQuestionIds: data.flaggedQuestionIds, ...values };
    setPending(true);
    if (user) backupExamSave(user.id, examId, operation.current);
    void run(sendPending);
  }
  function finish() {
    setConfirm(false);
    finishRequested.current = true;
    void run(async () => {
      await sendPending();
      const res = await fetch(`/api/exams/${examId}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); apply(data); finishRequested.current = false;
    });
  }
  async function reload() {
    await read(); operation.current = null; setPending(false); if (user) backupExamSave(user.id, examId, null);
  }
  const q = snapshot?.questions[snapshot.currentIndex], result = snapshot?.result;
  return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <Link href="/exam" className="text-sm text-primary underline">Все экзамены</Link>
    {error && <div role="alert" className="space-y-2 rounded border border-red-400 p-3"><p>{error}</p>
      <Button variant="outline" disabled={busy} onClick={() => finishRequested.current ? finish() : void run(pending ? sendPending : async () => { await read(); })}>Повторить запрос</Button>
      {pending && <Button variant="ghost" disabled={busy} onClick={() => void run(reload)}>Загрузить серверную версию и отбросить несохранённое изменение</Button>}
    </div>}
    {!snapshot ? <p>Загрузка экзамена…</p> : result ? <>
      <h1 className="text-3xl font-bold">Результат: {result.points}/{result.maxPoints} баллов</h1>
      <p>{result.completionReason === "timeout" ? "Время истекло." : "Экзамен завершён."} Пропущено: {result.skipped}. Профиль {snapshot.profile.id}@{snapshot.profile.version}; язык — русский.</p>
      <p className="text-sm text-muted-foreground">{result.masteryPolicy}</p>
      {result.previouslyExposedCount > 0 && <p className="text-sm">Ранее встречались {result.previouslyExposedCount} заданий. Они учитываются в баллах блока, но не дают независимого подтверждения навыков.</p>}
      <section className="rounded-xl border p-4"><h2 className="mb-3 text-xl font-semibold">Результат по темам</h2>
        <ul className="space-y-2">{result.topics.map((t) => <li key={t.topicId} className="flex justify-between gap-4"><span>{t.name}</span><strong>{t.points}/{t.maxPoints}</strong></li>)}</ul>
      </section>
      <section className="rounded-xl border p-4"><h2 className="mb-3 text-xl font-semibold">Навыки и Mastery Score</h2><p className="mb-3 text-sm text-muted-foreground">Для вывода об освоении нужно несколько разных заданий. Пропуск показывает нехватку ответа, а не доказанную причину ошибки.</p>
        <ul className="space-y-2">{result.skills.map((s) => <li key={s.skillId}>{s.name}: <strong>{s.points}/{s.maxPoints}</strong> · {s.state === "insufficient" ? "Недостаточно данных об освоении" : `Mastery Score: ${s.masteryScore}`}</li>)}</ul>
      </section>
      <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-semibold">Пробелы и дальнейшие действия</h2>
        {result.gaps.length ? result.gaps.map((g) => <div key={g.questionId} className="border-b pb-3"><p className="font-medium">{g.title} · {g.reason === "skipped" ? "Нет ответа" : "Неверный ответ"}</p><p className="my-2 text-sm">{g.action}</p><div className="flex flex-wrap gap-4 text-primary underline"><Link href={g.ruleHref}>Повторить правило</Link><Link href={g.practiceHref}>Тренировка темы</Link></div></div>) : <p>В этом блоке ошибок нет. Продолжайте подготовку на новых заданиях.</p>}
        <p className="text-sm">План дня учитывает отвеченные задания и ошибки экзамена. Если сегодняшняя работа уже начата, новые результаты применяются к следующему плану. Нехватка практики или независимых проверочных задач отображается в плане.</p>
        <Button asChild><Link href="/">Открыть персональный план подготовки</Link></Button>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Ответы и разбор</h2>{result.questions.map((item, i) => <details key={item.id} className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">{i + 1}. {item.title} — {item.points}/{item.maxPoints}{item.skipped ? " · пропуск" : ""}</summary>
        <div className="mt-3 space-y-2"><MathText content={item.questionText} /><p>Ваш ответ: {item.answer === null ? "Пропуск" : item.options[item.answer]}</p><p>Правильный ответ: {item.options[item.correctIndex]}</p><MathText content={item.explanation} /></div>
      </details>)}</section>
    </> : q ? <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Задание {snapshot.currentIndex + 1} из {snapshot.questions.length}</h1>
        <div role="timer" aria-label="Оставшееся время" className="rounded bg-muted px-4 py-2 font-mono text-xl tabular-nums">{Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</div>
      </div>
      <p className="text-sm text-muted-foreground">{snapshot.profile.id}@{snapshot.profile.version} · Русский · учебный лимит {snapshot.durationMinutes} минут. Отвечено {Object.keys(snapshot.answers).length}/{snapshot.questions.length}. {busy ? "Сохраняем…" : pending ? "Изменение ещё не подтверждено сервером" : "Изменения сохранены"}</p>
      <nav aria-label="Переход между заданиями" className="flex flex-wrap gap-2">{snapshot.questions.map((item, i) =>
        <button key={item.id} aria-current={i === snapshot.currentIndex ? "step" : undefined} aria-label={`Задание ${i + 1}${snapshot.flaggedQuestionIds.includes(item.id) ? ", вернуться позже" : ""}`} disabled={busy || pending || seconds === 0}
          onClick={() => change({ currentIndex: i })} className={`h-10 w-10 rounded-lg border text-sm ${i === snapshot.currentIndex ? "ring-2 ring-primary" : ""} ${snapshot.answers[item.id] !== undefined ? "bg-primary/15" : ""}`}>
          {i + 1}{snapshot.flaggedQuestionIds.includes(item.id) && <span aria-hidden="true">*</span>}
        </button>)}</nav>
      <fieldset className="space-y-4 rounded-2xl border bg-card p-5" disabled={busy || pending || seconds === 0}>
        <legend className="px-2 font-semibold">Пункт {q.pointCode} · сложность {q.band}</legend><MathText content={q.questionText} />
        {q.options.map((text, index) => <label key={index} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${snapshot.answers[q.id] === index ? "border-primary bg-primary/10" : ""}`}>
          <input type="radio" name={q.id} aria-label={`Вариант ${index + 1}: ${text}`} checked={snapshot.answers[q.id] === index} onChange={() => change({ answers: { ...snapshot.answers, [q.id]: index } })} /><MathText content={text} />
        </label>)}
        <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => change({ flaggedQuestionIds: snapshot.flaggedQuestionIds.includes(q.id) ? snapshot.flaggedQuestionIds.filter((id) => id !== q.id) : [...snapshot.flaggedQuestionIds, q.id] })}>{snapshot.flaggedQuestionIds.includes(q.id) ? "Снять отметку" : "Вернуться позже"}</Button>
          <Button variant="ghost" disabled={snapshot.answers[q.id] === undefined} onClick={() => { const answers = { ...snapshot.answers }; delete answers[q.id]; change({ answers }); }}>Очистить ответ</Button></div>
      </fieldset>
      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy || pending || seconds === 0 || snapshot.currentIndex === 0} onClick={() => change({ currentIndex: snapshot.currentIndex - 1 })}>Назад</Button>
        <Button variant="outline" disabled={busy || pending || seconds === 0 || snapshot.currentIndex + 1 === snapshot.questions.length} onClick={() => change({ currentIndex: snapshot.currentIndex + 1 })}>Далее</Button>
        <Button disabled={busy} onClick={() => setConfirm(true)}>Завершить экзамен</Button></div>
      {seconds === 0 && <p role="status">Время истекло. Сервер завершит экзамен при ближайшем запросе; новые ответы не принимаются.</p>}
      {confirm && <section role="alertdialog" aria-label="Завершение экзамена" className="space-y-3 rounded-xl border border-primary p-5"><p>Завершить экзамен? Без ответа останутся {snapshot.questions.length - Object.keys(snapshot.answers).length} заданий. После завершения изменить ответы нельзя.</p><div className="flex gap-3"><Button disabled={busy} onClick={finish}>Подтвердить завершение</Button><Button variant="outline" onClick={() => setConfirm(false)}>Продолжить</Button></div></section>}
    </> : null}
  </div>;
}
