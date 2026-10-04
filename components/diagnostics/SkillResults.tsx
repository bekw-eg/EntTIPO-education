"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { diagnosticText } from "@/lib/i18n/diagnostics";
import type { DiagnosticReport, SkillProgressView } from "@/types/diagnostics";

export function SkillPracticeButton({ skill }: { skill: SkillProgressView }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale === "kk" ? "kk" : "ru"];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const recommendation = skill.recommendation;
  if (!recommendation) return null;
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mixed", totalCount: 1, skillId: skill.id, questionId: recommendation.id }) });
      if (!response.ok) throw new Error(copy.error);
      router.push(`/practice/session/${(await response.json()).id}`);
    } catch { toast.error(copy.error); setBusy(false); }
  };
  return <div className="space-y-2 border-t pt-4">
    <p className="text-sm font-medium">{locale === "kk" ? recommendation.questionTextKk ?? recommendation.questionText : recommendation.questionText}</p>
    {recommendation.latex && <MathDisplay math={recommendation.latex} />}
    <Button disabled={busy} onClick={() => { void start(); }}>{copy.practice}</Button>
  </div>;
}

export function SkillProgressCards({ skills }: { skills: SkillProgressView[] }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale === "kk" ? "kk" : "ru"];
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">{copy.progress}</h2>
    <div className="grid gap-4 lg:grid-cols-3">{skills.map((skill) => <Card key={skill.id} className="p-5 space-y-3">
      <h3 className="font-semibold">{locale === "kk" ? skill.nameKk : skill.nameRu}</h3>
      <p className="text-sm">{copy[skill.state]}{skill.state !== "insufficient" ? ` · ${skill.masteryScore}%` : ""}</p>
      <p className="text-xs text-muted-foreground">{copy.observations}: {skill.observationCount} · {copy.unique}: {skill.distinctQuestions}</p>
      <p className="text-sm text-muted-foreground">{locale === "kk" ? skill.explanationKk : skill.explanationRu}</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">{copy.repeat}</summary>
        <p className="mt-2">{locale === "kk" ? skill.ruleKk : skill.ruleRu}</p></details>
      <SkillPracticeButton skill={skill} />
    </Card>)}</div>
  </section>;
}

export function DiagnosticResults({ report }: { report: DiagnosticReport }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale === "kk" ? "kk" : "ru"];
  return <section className="space-y-5">
    <h2 className="text-2xl font-bold">{copy.result}</h2>
    <p>{copy.checked}: {report.totalCount} · {copy.correct}: {report.correctCount}</p>
    <p className="text-sm text-muted-foreground">{copy.limited}</p>
    {[...report.skills].sort((a, b) => Number(b.assessment === "gap_observed") - Number(a.assessment === "gap_observed")).map((skill) => <Card key={skill.id} className="p-5 space-y-4">
      <h3 className="text-lg font-semibold">{locale === "kk" ? skill.nameKk : skill.nameRu}</h3>
      <p className={skill.assessment === "gap_observed" ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>{copy[skill.assessment]}</p>
      {skill.evidence.filter((e) => !e.isCorrect).map((e) => <p key={e.stepId} className="text-sm">{locale === "kk" ? e.feedback?.kk : e.feedback?.ru}</p>)}
      <details open={skill.assessment === "gap_observed"} className="space-y-3">
        <summary className="text-sm font-medium cursor-pointer">{copy.evidence} ({skill.evidence.length})</summary>
        {skill.evidence.map((e) => <div key={e.stepId} className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
          <p className="font-medium">{locale === "kk" ? e.questionTextKk ?? e.questionText : e.questionText}</p>
          <p>{copy.yourAnswer}: <strong className="font-mono break-all">{e.userAnswer}</strong> · {e.isCorrect ? copy.correct : copy.incorrect}</p>
          <p>{copy.expected}: <strong className="font-mono">{e.expectedAnswer}</strong></p>
          <p className="text-muted-foreground">{locale === "kk" ? e.explanationKk ?? e.explanation : e.explanation}</p>
        </div>)}
      </details>
      <div className="space-y-2"><h4 className="text-sm font-semibold">{copy.repeat}</h4><p className="text-sm">{locale === "kk" ? skill.ruleKk : skill.ruleRu}</p></div>
      <SkillPracticeButton skill={skill} />
    </Card>)}
  </section>;
}
