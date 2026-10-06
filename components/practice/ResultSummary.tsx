"use client";

import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { analysisText } from "@/lib/i18n/result-analysis";
import { choiceStem } from "@/lib/choiceDisplay";
import { MathText } from "@/components/ui/MathText";

export function ResultSummary({ topic, isCorrect, isPartial, failedCount, isChoice, insight, hasUnclassified }: {
  topic: string; isCorrect: boolean; isPartial: boolean; failedCount: number; isChoice: boolean;
  insight?: string; hasUnclassified: boolean;
}) {
  const { locale } = useLanguage();
  const copy = analysisText[locale];
  const StatusIcon = isCorrect ? CheckCircle2 : XCircle;
  return <>
    <header className="space-y-3 px-1" data-result-header>
      <p className="text-sm font-medium text-muted-foreground">{copy.result}</p>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{topic}</h2>
      <div role="status" className="flex items-start gap-2 text-sm font-medium sm:text-base">
        <StatusIcon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
        <span>{isCorrect ? copy.correct : isPartial ? copy.partial : copy.incorrect}</span>
      </div>
      {!isChoice && failedCount > 1 && <p className="text-sm text-muted-foreground">{copy.failedSteps(failedCount)}</p>}
    </header>
    {!isCorrect && <section aria-labelledby="analysis-insight-title" className="flex gap-3 border-l-2 border-primary pl-4 py-1" data-main-insight>
      <CircleHelp aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 space-y-2">
        <h3 id="analysis-insight-title" className="font-semibold">{copy.insight}</h3>
        {insight ? <MathText className="analysis-copy" content={choiceStem(insight)} />
          : <p className="text-sm leading-relaxed text-muted-foreground">{hasUnclassified ? copy.unclassified : copy.neutral}</p>}
      </div>
    </section>}
  </>;
}
