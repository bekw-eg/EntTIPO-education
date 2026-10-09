"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { errorText } from "@/lib/i18n/messages";

type Summary = { id: string; status: string; startedAt: string; language: string; points: number | null; maxPoints: number };
export function ExamHistory() {
  const { locale } = useLanguage(), kk = locale === "kk";
  const [history, setHistory] = useState<Summary[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void fetch("/api/exams", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (alive) setHistory(data);
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const active = history.find(exam => exam.status === "active");
  return <><Header title={kk ? "Менің нәтижелерім" : "Мои результаты"} /><div className="page-content reading-content">
    {loading && <p role="status">{kk ? "Жүктелуде…" : "Загрузка…"}</p>}
    {error && <div role="alert"><p>{errorText(error, locale)}</p><Button variant="outline" onClick={() => window.location.reload()}>{kk ? "Қайталау" : "Повторить загрузку"}</Button></div>}
    {active && <div className="space-y-3 rounded-lg border p-4"><p>{kk ? "Бұрынғы шешімдерді ашу үшін ағымдағы сынақты аяқтаңыз." : "Чтобы открыть разбор прошлых результатов, завершите текущий пробник."}</p>
      <Button asChild><Link href={`/exam/${active.id}`}>{kk ? "Сынақты жалғастыру" : "Продолжить пробник"}</Link></Button></div>}
    {!loading && !error && !history.some(exam => exam.status === "completed") && <p>{kk ? "Аяқталған сынақ нәтижелері осында пайда болады." : "Здесь появятся результаты завершённых пробников."}</p>}
    <div className="space-y-3">{history.filter(exam => exam.status === "completed").map(exam => {
      const content = <><span className="min-w-0"><span className="block">{new Date(exam.startedAt).toLocaleString(kk ? "kk-KZ" : "ru-RU", { timeZone: "Asia/Qyzylorda" })}</span>
        <span className="text-sm text-muted-foreground">{exam.language === "kk" ? "Қазақша" : "Русский"}</span></span><strong className="shrink-0">{exam.points}/{exam.maxPoints}</strong></>;
      const className = "flex items-center justify-between gap-4 rounded-lg border p-4";
      return active ? <div key={exam.id} className={className}>{content}</div> : <Link key={exam.id} href={`/exam/${exam.id}`} className={className + " hover:bg-muted"}>{content}</Link>;
    })}</div>
    <Link href="/" className="inline-flex min-h-11 items-center text-primary underline">{kk ? "Сынаққа өту" : "К пробнику"}</Link>
  </div></>;
}
