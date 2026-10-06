"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { learningText } from "@/lib/i18n/learning";
import { PageLoading } from "@/components/ui/page-state";
import type { getDailyLearningPlan } from "@/lib/dailyLearningPlan";

type Plan = Awaited<ReturnType<typeof getDailyLearningPlan>>;
export function DailyLearningPlanCard() {
  const { locale } = useLanguage(), router = useRouter();
  const copy = learningText[locale === "kk" ? "kk" : "ru"];
  const [plan, setPlan] = useState<Plan | null>(null), [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [zone, setZone] = useState(""), [editZone, setEditZone] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/learning-plan", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json(); setPlan(data); setZone(data.timeZone); setError(false);
    } catch { setError(true); }
  }
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);
  async function start(actionId: string) {
    setBusy(actionId);
    try {
      const response = await fetch("/api/learning-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", actionId }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.href) router.push(data.href);
      else { if (data.unavailable) toast.info(copy.noSimilar); await load(); }
    } catch { toast.error(copy.error); } finally { setBusy(null); }
  }
  async function recalculate() {
    setBusy("recalculate");
    try {
      const response = await fetch("/api/learning-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate" }) });
      if (!response.ok) throw new Error(); setPlan(await response.json());
    } catch { toast.error(copy.policy); } finally { setBusy(null); }
  }
  async function saveZone() {
    try {
    const response = await fetch("/api/user", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeZone: zone }) });
    if (!response.ok) { toast.error(copy.invalidZone); return; }
    setEditZone(false); toast.success(copy.zoneSaved); await load();
    } catch { toast.error(copy.error); }
  }
  const nextId = plan?.actions.find((a) => !a.completedAt)?.id;
  return <Card className="border-t-2 border-t-primary">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{copy.title}</CardTitle>
      <p className="text-sm text-muted-foreground">{copy.intro}</p></CardHeader>
    <CardContent className="space-y-4">
      {error ? <div role="alert">{copy.error}<Button variant="ghost" onClick={load}>{copy.reload}</Button></div> : !plan ? <PageLoading /> : <>
        <ol className="divide-y">
          {plan.actions.map((action, index) => {
            const skillName = locale === "kk" ? action.skill?.nameKk : action.skill?.nameRu;
            const label = action.kind === "rule" ? copy.rule : action.kind === "practice" ? `${copy.practice} (${action.questionIds.length})`
              : action.kind === "diagnostic" ? copy.diagnostic : action.mistakeId ? copy.check : copy.selfCheck;
            const reasonKeys = [...new Set([action.reasons.includes("carried") ? "carried" : action.reasons[0],
              action.kind === "check" ? action.reasons.at(-1) : undefined])].filter(Boolean) as (keyof typeof copy.reasons)[];
            return <li key={action.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
                <p className="font-semibold">{action.completedAt ? <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" /> : `${index + 1}. `}{label}</p>
                {skillName && <p className="mt-1 text-sm font-medium">{skillName}</p>}
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{reasonKeys.map((key) => copy.reasons[key]).join(" ")}</p>
                {action.kind === "practice" && <p className="mt-1 text-xs text-muted-foreground">{action.completedQuestionCount}/{action.questionIds.length} {copy.completedCount}</p>}
                {action.status === "blocked" && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{action.kind === "practice" ? copy.noPractice : copy.noSimilar}</p>}
                {action.status === "retry" && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{copy.retry}</p>}
                {action.mistake?.confirmedAt && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{copy.confirmed}</p>}
                {action.kind === "check" && action.nextReviewDay && <p className="mt-1 text-sm">{copy.next}: {action.nextReviewDay}</p>}
              </div><div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs font-medium text-muted-foreground">{action.completedAt ? copy.done : action.id === nextId ? copy.now : ""}</span>
                {!action.completedAt && <Button variant={action.id === nextId ? "default" : "outline"} size="sm" disabled={!!busy || (action.status === "blocked" && action.kind !== "check")} onClick={() => start(action.id)}>
                  {action.kind === "rule" ? copy.open : action.sessionId && action.status !== "retry" ? copy.resume : copy.start}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
              </div></div>
            </li>;
          })}
        </ol>
        {!nextId && <p className="text-sm text-emerald-700 dark:text-emerald-400">{copy.allDone}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{plan.day} · {copy.timezone}: {plan.timeZone} <button className="underline" onClick={() => setEditZone(!editZone)}>{copy.timezone}</button></span>
          <span>{plan.actions.filter((a) => a.completedAt).length}/{plan.actions.length} {copy.completedCount}</span>
        </div>
        {editZone && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void saveZone(); }}>
          <label className="text-sm">{copy.timezone}<input className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2" value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Asia/Qyzylorda" /></label>
          <Button type="submit" size="sm" variant="outline">{copy.save}</Button>
        </form>}
        {plan.canRecalculate && <Button variant="outline" disabled={!!busy} onClick={recalculate}>{copy.recalculate}</Button>}
      </>}
    </CardContent>
  </Card>;
}
