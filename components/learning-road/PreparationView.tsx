"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/layout/Header";
import { MathText } from "@/components/ui/MathText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { preparationText } from "@/lib/i18n/preparation";
import type { PreparationView as View } from "@/lib/learning-road/program";

export function PreparationView({ compact = false }: { compact?: boolean }) {
  const { locale } = useLanguage(), copy = preparationText[locale], router = useRouter();
  const [road, setRoad] = useState<View | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [shortage, setShortage] = useState(false);
  const sending = useRef(false), pending = useRef<{ nodeId: string; action: "check" | "practice"; requestId: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/preparation", { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRoad(data); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : copy.error); }
  }, [copy.error]);
  useEffect(() => { void load(); const refresh = () => { if (!sending.current) void load(); };
    window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh);
  }, [load]);
  const current = road?.nodes.find(n => n.status === "current");
  const name = (id: string) => { const skill = road?.skills.find(s => s.id === id); return skill ? locale === "kk" ? skill.nameKk : skill.nameRu : id; };
  async function start() {
    if (!current || sending.current) return;
    sending.current = true; setBusy(true); setError(""); setShortage(false);
    const action = current.phase === "repair" || current.phase === "practice" ? "practice" : "check";
    if (pending.current?.nodeId !== current.id || pending.current.action !== action) pending.current = { nodeId: current.id, action, requestId: crypto.randomUUID() };
    try {
      const response = await fetch("/api/preparation", { method: "POST", headers: { "Content-Type": "application/json", "x-ent-locale": locale }, body: JSON.stringify(pending.current) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      pending.current = null;
      if (data.href) router.push(data.href);
      else { setShortage(!!data.unavailable); await load(); }
    } catch (e) { setError(e instanceof Error ? e.message : copy.error); }
    finally { sending.current = false; setBusy(false); }
  }
  const action = !road ? null : road.activeExamId ? <Button asChild><Link href={`/exam/${road.activeExamId}`}>{copy.resume}</Link></Button>
    : road.stage === "diagnostic_needed" || road.stage === "diagnostic_active" ? <Button asChild><Link href="/diagnostics">{road.stage === "diagnostic_active" ? copy.resumeDiagnostic : copy.diagnostic}</Link></Button>
    : road.stage === "completed" ? <Button asChild><Link href="/mistakes?view=reviews">{copy.rule}</Link></Button>
    : current ? <Button disabled={busy} onClick={() => void start()}>{current.phase === "practice" ? copy.resume : current.phase === "repair" ? copy.practice : copy.check}</Button> : null;
  const content = <>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => void load()}>{copy.reload}</Button></div>}
    {!road && !error && <p role="status" className="text-sm text-muted-foreground">…</p>}
    {road && <>
      <p className="font-medium" data-testid="preparation-stage">{copy.stages[road.stage]}</p>
      <p className="text-sm text-muted-foreground">{copy.intro}</p>
      {!!road.totalSkills && <div className="space-y-2"><p>{copy.confirmed}: <strong>{road.confirmedSkillIds.length} / {road.totalSkills}</strong> {copy.skills}</p>
        <Progress aria-label={copy.confirmed} value={100 * road.confirmedSkillIds.length / road.totalSkills} className="h-2" />
        <p className="text-sm text-muted-foreground">{copy.untilMixed}: {road.blocksToMixed}</p>
        {!!road.confirmedSkillIds.length && <details><summary className="cursor-pointer text-sm">{copy.confirmed}</summary><ul className="list-disc pl-5 text-sm">{road.confirmedSkillIds.map(id => <li key={id}>{name(id)}</li>)}</ul></details>}
      </div>}
      {current && !road.activeExamId && <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">{copy.types[current.type]}{current.type === "SKILL" ? ` · ${name(current.skillId)}` : ""}</h3>
        <p className="text-sm text-muted-foreground">{copy.reasons[current.reason]}</p>
        {current.phase !== "check" && <p className="text-sm">{copy.repair}</p>}
        <div className="flex flex-wrap gap-3">{(current.repairSkillIds.length ? current.repairSkillIds : current.skillIds).map(id => <Link key={id} href={`/learn/rules/${encodeURIComponent(id)}`} className="text-sm text-primary underline">{copy.rule}: {name(id)}</Link>)}</div>
        {current.assessments.filter(a => a.status === "completed").slice(-1).map(a => <Link key={a.id} href={`/exam/${a.id}`} className="block text-sm text-primary underline">{copy.result}: {a.points} / {a.maxPoints}</Link>)}
      </div>}
      {(shortage || current?.unavailable || road.stage === "content_shortage") && <p role="status" className="rounded-md border p-3 text-sm">{copy.shortage}</p>}
      <div className="flex flex-wrap gap-3">{action}{compact && !!road.id && <Button variant="outline" asChild><Link href="/learning-road">{copy.open}</Link></Button>}</div>
      {!compact && <>
        {road.policy && <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">{copy.policy}</summary>
          <p className="mt-2 text-sm">{copy.types.SKILL}: {road.policy.blockSize} · ≥ {Math.round(road.policy.passRatio * 100)}% · {copy.confirmed}: ≥ {road.policy.minimumIndependentCorrect}.</p>
          <p className="text-sm">{copy.types.MIXED}: {road.policy.mixedPerSkill} × {copy.skills} · {copy.untilMixed}: {road.policy.mixedEvery}.</p>
          <p className="text-sm">{copy.types.FINAL}: ≥ {Math.round(road.policy.finalPassRatio * 100)}%.</p><p className="mt-2 text-sm text-muted-foreground">{copy.training}</p></details>}
        <ol className="divide-y" aria-label={copy.title}>{road.nodes.map((node, index) => <li key={node.id} data-testid={`preparation-node-${node.type}`} aria-current={node.status === "current" ? "step" : undefined} className="py-5 space-y-2">
          <div className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm ${node.status === "current" ? "border-primary text-primary" : "text-muted-foreground"}`}>{node.status === "confirmed" ? "✓" : index + 1}</span>
            <div className="min-w-0"><h2 className="font-semibold">{node.type === "SKILL" ? name(node.skillId) : copy.types[node.type]}</h2>
              <p className="text-sm text-muted-foreground">{node.status === "confirmed" ? copy.confirmed : node.status === "locked" ? copy.locked : copy.stages.learning}</p></div></div>
          <div className="text-sm"><span className="font-medium">{copy.goal}: </span><MathText content={node.type === "SKILL" ? locale === "kk" ? node.goalKk : node.goalRu : node.skillIds.map(name).join(" · ")} /></div>
          <p className="text-sm text-muted-foreground">{copy.reasons[node.reason]}</p>
          {!!node.prerequisiteIds.length && <p className="text-sm">{copy.prerequisites}: {node.prerequisiteIds.map(name).join(" · ")}</p>}
          {node.assessments.filter(a => a.status === "completed").map(a => <Link key={a.id} href={`/exam/${a.id}`} className="block text-sm text-primary underline">{copy.result}: {a.points} / {a.maxPoints}</Link>)}
        </li>)}</ol>
        {road.history.length > 1 && <details><summary className="cursor-pointer font-medium">{copy.history}</summary><ul className="mt-3 space-y-2">{road.history.map(cycle => <li key={cycle.id}>#{cycle.sequence} · {cycle.reason === "final_gaps" ? copy.stages.reinforcement : copy.start}{cycle.sourceExamId && <Link href={`/exam/${cycle.sourceExamId}`} className="ml-3 text-primary underline">{copy.result}</Link>}</li>)}</ul></details>}
        <Link href="/learning-road?legacy=1" className="block text-sm text-primary underline">{copy.legacy}</Link>
      </>}
    </>}
  </>;
  return compact ? <Card data-testid="preparation-card"><CardContent className="space-y-4 p-5 sm:p-6"><h2 className="text-lg font-semibold">{copy.title}</h2>{content}</CardContent></Card>
    : <><Header title={copy.title} /><div className="page-content reading-content space-y-5">{content}</div></>;
}
