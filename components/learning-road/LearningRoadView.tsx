"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Dumbbell, Wrench, RotateCcw, Flag, Check, Route } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";
import { PageLoading } from "@/components/ui/page-state";
import { cn } from "@/lib/utils";
import type { RoadNodeType } from "@/lib/learning-road/types";
import { useLearningRoad } from "./useLearningRoad";

const icons = { THEORY: BookOpen, PRACTICE: Dumbbell, REPAIR: Wrench, REVIEW: RotateCcw, CHECKPOINT: Flag } satisfies Record<RoadNodeType, typeof BookOpen>;
export function LearningRoadView() {
  const { locale } = useLanguage(), copy = roadText[locale], router = useRouter();
  const { road, error, reload } = useLearningRoad();
  const [selectedId, setSelectedId] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const selected = road?.nodes.find(node => node.id === selectedId);
  const current = road?.nodes.find(node => node.status === "CURRENT");
  const name = (node: { nameRu: string; nameKk: string }) => locale === "kk" ? node.nameKk : node.nameRu;
  async function run(action: "start" | "skip_unavailable" | "next_block", nodeId?: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const response = await fetch("/api/learning-road", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(nodeId ? { nodeId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? copy.error);
      if (data.href) router.push(data.href);
      else { await reload(); if (!data.unavailable) setSelectedId(null); }
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : copy.error); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div><Header title={copy.title} />
    <div className="page-content reading-content">
      <p className="text-muted-foreground">{copy.intro}</p>
      {error ? <Card><CardContent className="p-6 space-y-3"><p role="alert">{copy.error}</p><Button onClick={() => { void reload(); }}>{copy.reload}</Button></CardContent></Card>
        : !road ? <PageLoading /> : <>
        {road.needsDiagnostic && <Card><CardContent className="p-5 space-y-3"><p className="text-sm text-muted-foreground">{copy.diagnosticNote}</p>
          <Button variant="outline" asChild><Link href="/diagnostics">{copy.diagnostic}</Link></Button></CardContent></Card>}
        {!!road.nodes.length && <Card className="border-primary/20"><CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3"><Route className="text-primary h-6 w-6 shrink-0" aria-hidden="true" />
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{copy.focus}</p><p className="font-semibold break-words">{current ? name(current) : copy.finished}</p></div></div>
          <p className="text-sm" aria-live="polite">{copy.progress}: {road.completedCount} / {road.nodes.length}</p>
          <Progress aria-label={copy.progress} value={100 * road.completedCount / road.nodes.length} />
          {current && <Button className="w-full sm:w-auto" onClick={event => { returnFocusRef.current = event.currentTarget; setSelectedId(current.id); }}>{copy.continue}</Button>}
          <p className="text-xs text-muted-foreground">{copy.policy}</p>
        </CardContent></Card>}
        {!road.nodes.length && <p>{copy.empty}</p>}
        <ol className={cn("relative mx-auto max-w-md py-4", !!road.nodes.length && "before:absolute before:left-1/2 before:top-12 before:bottom-12 before:border-l-2 before:border-dashed before:border-primary/20")} aria-label={copy.title}>
          {road.nodes.map((node, index) => {
            const Icon = icons[node.type], isCurrent = node.status === "CURRENT", done = node.status === "COMPLETED";
            return <li key={node.id} className="relative flex justify-center pb-10 last:pb-0">
              <div className={cn("flex flex-col items-center max-w-[220px]", index % 3 === 0 ? "translate-x-7" : index % 3 === 1 ? "-translate-x-7" : "translate-x-0")}>
              <button data-road-node type="button" onClick={event => { returnFocusRef.current = event.currentTarget; setSelectedId(node.id); }} aria-current={isCurrent ? "step" : undefined}
                aria-label={`${copy.types[node.type]}: ${name(node)}. ${node.skipped ? copy.skipped : copy.statuses[node.status]}`}
                onKeyDown={event => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  const buttons = event.currentTarget.closest("ol")?.querySelectorAll<HTMLButtonElement>("[data-road-node]");
                  buttons?.[Math.max(0, Math.min(road.nodes.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
                }}
                className={cn("flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4",
                  isCurrent ? "h-16 w-16 border-primary bg-primary text-primary-foreground" : "h-14 w-14 bg-card",
                  done ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : !isCurrent && "border-border text-muted-foreground hover:border-primary") }>
                {done ? <Check aria-hidden="true" className="h-6 w-6" /> : <Icon aria-hidden="true" className="h-6 w-6" />}
              </button>
              <div className="mt-3 max-w-[220px] text-center space-y-1 bg-background/95 rounded-lg px-2">
                <p className="text-xs font-medium text-muted-foreground">{copy.types[node.type]} · {node.skipped ? copy.skipped : copy.statuses[node.status]}</p>
                <p className={cn("text-sm break-words", isCurrent && "font-semibold")}>{name(node)}</p>
              </div>
              </div>
            </li>;
          })}
        </ol>
        {road.finished && <Card><CardContent className="p-5 space-y-3"><p>{copy.finished}</p><Button disabled={busy} onClick={() => { void run("next_block"); }}>{copy.nextBlock}</Button></CardContent></Card>}
        <p className="text-xs text-muted-foreground">{copy.participation}</p>
      </>}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        {selected && <DialogContent className="sm:max-w-lg" closeLabel={copy.back}
          onCloseAutoFocus={event => { event.preventDefault(); returnFocusRef.current?.focus(); }}>
          <DialogTitle className="pr-6 leading-normal">{name(selected)}</DialogTitle>
          <DialogDescription>{copy.types[selected.type]} · {selected.skipped ? copy.skipped : copy.statuses[selected.status]}</DialogDescription>
          <p className="text-sm">{copy.mastery}: {selected.masteryScore === null ? copy.insufficient : `${selected.masteryScore}%`}</p>
          <div className="space-y-2"><h3 className="font-semibold text-sm">{copy.why}</h3><p className="text-sm text-muted-foreground">{copy.reasons[selected.reason]}</p></div>
          {!!selected.prerequisites.length && <div className="rounded-lg border bg-muted/40 p-3 space-y-2"><p className="text-sm">{copy.prerequisite}:</p>
            {selected.prerequisites.map(skill => <Link key={skill.id} href={`/learn/rules/${encodeURIComponent(skill.id)}`} className="block text-sm text-primary underline">{name(skill)}</Link>)}
            <p className="text-xs text-muted-foreground">{copy.optional}</p></div>}
          <p className="text-sm">{selected.questionCount > 0 && `${selected.questionCount} ${copy.tasks} · `}≈ {selected.estimatedMinutes} {copy.minutes}</p>
          {selected.outcome && selected.outcome !== "pending" && <p role="status" className="text-sm">{selected.outcome === "passed" ? copy.passed : copy.failed}</p>}
          {selected.unavailable && !selected.skipped && <p role="status" className="text-sm text-muted-foreground">{copy.unavailable}</p>}
          {selected.status !== "COMPLETED" && <Button disabled={busy} className="min-h-11" onClick={() => { void run(selected.unavailable ? "skip_unavailable" : "start", selected.id); }}>
            {selected.unavailable ? copy.skip : selected.sessionId ? copy.continue : copy.start}</Button>}
          {selected.status === "COMPLETED" && (selected.sessionId || selected.type === "THEORY") && <Button variant="outline" disabled={busy} onClick={() => { void run("start", selected.id); }}>{copy.types[selected.type]}</Button>}
        </DialogContent>}
      </Dialog>
    </div>
  </div>;
}
