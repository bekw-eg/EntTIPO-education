"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { analysisText } from "@/lib/i18n/result-analysis";
import { choiceStem } from "@/lib/choiceDisplay";
import { MathText } from "@/components/ui/MathText";
import { MathDisplay } from "@/components/ui/MathDisplay";
import type { ReviewAnswer, ReviewItem } from "@/lib/resultAnalysis";
import { ChoiceMath } from "./ChoiceMath";

function AnswerBlock({ title, answers, correct }: { title: string; answers: ReviewAnswer[]; correct: boolean }) {
  const Icon = correct ? CheckCircle2 : XCircle;
  return <div className={`min-w-0 rounded-xl border p-3 sm:p-4 ${correct
    ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
      <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />{title}
    </h4>
    <ul className="space-y-2">
      {answers.map(answer => <li key={answer.id} className="flex min-w-0 items-baseline gap-2">
        {answer.letter && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{answer.letter}.</span>}
        <div className="min-w-0 flex-1 overflow-x-auto py-1"><ChoiceMath text={answer.text} /></div>
      </li>)}
    </ul>
  </div>;
}

export function MistakeCard({ item, questionNumber, questionText, latex, stepLabel, explanation, children }: {
  item: ReviewItem; questionNumber: number; questionText: string; latex?: string | null;
  stepLabel?: string; explanation?: string; children?: React.ReactNode;
}) {
  const { locale } = useLanguage();
  const copy = analysisText[locale];
  const headingId = `review-${item.id}`;
  return <article aria-labelledby={headingId} className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6" data-mistake-card>
    <div className="space-y-3">
      <h3 id={headingId} className="text-sm font-semibold text-muted-foreground">
        {copy.question(questionNumber)}{stepLabel && <span> · {stepLabel}</span>}
      </h3>
      <MathText className="analysis-question" content={choiceStem(questionText.replace(/\[GEOMETRY:[\s\S]*?\]/g, ""))} />
      {latex && !latex.includes("[GEOMETRY:") && <div className="max-w-full overflow-x-auto py-2 text-lg"><MathDisplay math={latex} /></div>}
      {item.prompt && <MathText className="analysis-copy" content={choiceStem(item.prompt)} />}
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <AnswerBlock title={copy.yourAnswer} answers={item.selected} correct={item.isCorrect} />
      <AnswerBlock title={copy.correctAnswer} answers={item.expected} correct />
    </div>
    {(explanation || children) && <section className="space-y-3 border-t pt-5" aria-label={copy.why}>
      <h4 className="font-semibold">{copy.why}</h4>
      {explanation && <MathText className="analysis-copy" content={choiceStem(explanation)} />}
      {children}
    </section>}
  </article>;
}
