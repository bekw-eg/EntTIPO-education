"use client";

import { ChoiceMath } from "@/components/practice/ChoiceMath";
import { interfaceText } from "@/lib/i18n/interface";
import { choiceStem } from "@/lib/choiceDisplay";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { diagnosticText } from "@/lib/i18n/diagnostics";
import { contentText } from '@/lib/i18n/content';
import { MathText } from '@/components/ui/MathText';
import type { DiagnosticReport, SkillProgressView } from "@/types/diagnostics";

export function SkillPracticeButton({ skill }: { skill: SkillProgressView }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale];
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
    <MathText className="text-sm font-medium" content={contentText(recommendation.questionText, recommendation.questionTextKk, locale)} />
    {recommendation.latex && <MathDisplay math={recommendation.latex} />}
    <Button variant="outline" disabled={busy} onClick={() => { void start(); }}>{copy.practice}</Button>
  </div>;
}

export function SkillProgressCards({ skills }: { skills: SkillProgressView[] }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale];
  const observed = skills.filter(skill => skill.observationCount > 0);
  const remaining = skills.filter(skill => skill.observationCount === 0);
  const renderSkill = (skill: SkillProgressView) => <Card key={skill.id} className="rounded-none border-0 bg-transparent py-5 space-y-3">
      <h3 className="font-semibold">{locale === "kk" ? skill.nameKk : skill.nameRu}</h3>
      <p className="text-sm">{copy[skill.state]}{skill.state !== "insufficient" ? ` · ${skill.masteryScore}%` : ""}</p>
      <p className="text-xs text-muted-foreground">{copy.observations}: {skill.observationCount} · {copy.unique}: {skill.distinctQuestions}</p>
      <p className="text-sm text-muted-foreground">{locale === "kk" ? skill.explanationKk : skill.explanationRu}</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">{copy.repeat}</summary>
        <MathText className="mt-2" content={choiceStem(locale === "kk" ? skill.ruleKk : skill.ruleRu)} /></details>
      <SkillPracticeButton skill={skill} />
    </Card>;
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">{copy.progress}</h2>
    {!observed.length && <p className="text-sm text-muted-foreground">{interfaceText[locale].noSkills}</p>}
    <div className="divide-y">{observed.map(renderSkill)}</div>
    {!!remaining.length && <details className="border-t pt-2">
      <summary className="cursor-pointer text-sm font-medium">{interfaceText[locale].otherSkills} ({remaining.length})</summary>
      <div className="divide-y">{remaining.map(renderSkill)}</div>
    </details>}
  </section>;
}

export function DiagnosticResults({ report }: { report: DiagnosticReport }) {
  const { locale } = useLanguage();
  const copy = diagnosticText[locale];
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
          <MathText className="font-medium" content={contentText(e.questionText, e.questionTextKk, locale)} />
          <div className="flex flex-wrap items-baseline gap-1"><span>{copy.yourAnswer}:</span><div className="math-inline"><ChoiceMath text={locale === "kk" ? e.userAnswerTextKk ?? e.userAnswerText ?? e.userAnswer : e.userAnswerText ?? e.userAnswer} /></div><span>· {e.isCorrect ? copy.correct : copy.incorrect}</span></div>
          <div className="flex flex-wrap items-baseline gap-1"><span>{copy.expected}:</span><div className="math-inline"><ChoiceMath text={locale === "kk" ? e.expectedAnswerTextKk ?? e.expectedAnswerText ?? e.expectedAnswer : e.expectedAnswerText ?? e.expectedAnswer} /></div></div>
          <MathText className="text-muted-foreground" content={contentText(e.explanation, e.explanationKk, locale)} />
        </div>)}
      </details>
      <div className="space-y-2"><h4 className="text-sm font-semibold">{copy.repeat}</h4><MathText content={choiceStem(locale === "kk" ? skill.ruleKk : skill.ruleRu)} /></div>
      <SkillPracticeButton skill={skill} />
    </Card>)}
  </section>;
}
