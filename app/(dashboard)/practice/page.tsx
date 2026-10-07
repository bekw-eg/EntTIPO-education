"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Download, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading, LoadError } from "@/components/ui/page-state";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";
import { diagnosticText } from "@/lib/i18n/diagnostics";
import { errorText } from "@/lib/i18n/messages";

type Mode = "mixed" | "weak_topics" | "specific_topic" | "review_mistakes";
interface UnfinishedSession { id: string; mode: Mode; completedCount: number; totalCount: number }
function PracticeSetupContent() {
  const router = useRouter(), searchParams = useSearchParams();
  const { t, getTopicName, locale } = useLanguage();
  const skillId = searchParams.get("skillId") || undefined;
  const [totalCount, setTotalCount] = useState(20);
  const [mode, setMode] = useState(searchParams.get("mode") || "mixed");
  const [topicId, setTopicId] = useState(searchParams.get("topicId") || "");
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [unfinishedSessions, setUnfinishedSessions] = useState<UnfinishedSession[]>([]);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const [topicResponse, sessionResponse] = await Promise.all([fetch("/api/topics"), fetch("/api/sessions?status=active", { cache: "no-store" })]);
      if (!topicResponse.ok || !sessionResponse.ok) throw new Error();
      const [topicData, sessionData] = await Promise.all([topicResponse.json(), sessionResponse.json()]);
      setTopics(topicData); setUnfinishedSessions(sessionData);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function handleSubmit() {
    if (mode === "specific_topic" && !topicId) { toast.error(t.practice.selectTopicToast); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, totalCount: Number(totalCount), topicId: mode === "specific_topic" ? topicId : undefined, skillId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.session.loadError);
      router.push(`/practice/session/${data.id}`);
    } catch (failure) { toast.error(errorText(failure instanceof Error ? failure.message : t.session.loadError, locale)); setIsLoading(false); }
  }
  return <><Header title={t.practice.setupTitle} subtitle={t.practice.setupSubtitle} />
    <div className="page-content reading-content">
      {loading ? <PageLoading /> : error ? <LoadError retry={() => void load()} /> : <>
        {unfinishedSessions.length > 0 && <section className="space-y-3">
          <h2 className="section-title">{t.practice.unfinished}</h2>
          <div className="divide-y rounded-lg border bg-card px-4">
            {unfinishedSessions.map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><p className="text-sm font-medium">{t.practice.modes[session.mode]?.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.summary.solved}: {session.completedCount} / {session.totalCount}</p></div>
              <Button asChild variant="outline"><Link href={`/practice/session/${session.id}`}>{t.practice.resume}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
            </div>)}
          </div>
        </section>}
        <form className="space-y-8" onSubmit={event => { event.preventDefault(); void handleSubmit(); }}>
          <fieldset className="space-y-3">
            <legend className="section-title mb-3">{t.practice.trainingMode}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["mixed", "weak_topics", "specific_topic", "review_mistakes"] as Mode[]).map(id => <label key={id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${mode === id ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50"}`}>
                <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="radio" name="practice-mode" value={id} checked={mode === id} onChange={() => setMode(id)} />
                <span><span className="block text-sm font-medium">{t.practice.modes[id].title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.practice.modes[id].desc}</span></span>
              </label>)}
            </div>
          </fieldset>
          {mode === "specific_topic" && <div className="space-y-2"><Label htmlFor="topicSelect">{t.practice.topicLabel}</Label>
            <select id="topicSelect" value={topicId} onChange={e => setTopicId(e.target.value)} className="block w-full rounded-md border border-input bg-card px-3 text-sm">
              <option value="">{t.practice.chooseTopicPlaceholder}</option>{topics.map(item => <option key={item.id} value={item.id}>{getTopicName(item.name)}</option>)}
            </select></div>}
          <fieldset className="space-y-3 border-t pt-6">
            <legend className="section-title pr-3">{t.practice.tasksCount}</legend>
            <p className="text-sm text-muted-foreground">{t.practice.tasksCountDesc}</p>
            <div className="flex flex-wrap gap-2">{[10,20,30,40,50].map(count => <Button key={count} type="button" variant={totalCount === count ? "secondary" : "outline"}
              aria-pressed={totalCount === count} onClick={() => setTotalCount(count)} className={totalCount === count ? "ring-1 ring-primary text-primary" : ""}>{count}</Button>)}</div>
            <div className="space-y-2"><Label htmlFor="customCount" className="text-sm text-muted-foreground">{t.practice.customVariant}</Label>
              <Input id="customCount" type="number" min="1" max="100" value={totalCount} onChange={e => setTotalCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))} className="max-w-32" /></div>
          </fieldset>
          <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto">{isLoading ? t.practice.preparingTasks : `${t.practice.startPracticeBtn} (${totalCount})`}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Button>
        </form>
      </>}
      <div className="flex flex-col gap-1 border-t pt-4 text-sm">
        <Link href="/diagnostics" className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary"><ClipboardCheck aria-hidden="true" className="h-4 w-4" />{diagnosticText[locale === "kk" ? "kk" : "ru"].title}</Link>
        <a href="/offline-practice.html" className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary"><Download aria-hidden="true" className="h-4 w-4" />{interfaceText[locale].offline}</a>
      </div>
    </div>
  </>;
}
export default function PracticeSetupPage() {
  return <Suspense fallback={<div className="page-content reading-content"><PageLoading /></div>}><PracticeSetupContent /></Suspense>;
}
