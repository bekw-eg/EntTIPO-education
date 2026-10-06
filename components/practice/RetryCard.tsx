"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/ui/MathText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { analysisText } from "@/lib/i18n/result-analysis";
import { choiceStem } from "@/lib/choiceDisplay";

export function RetryCard({ questionText, isCorrect, isLoading, isLastQuestion, onRetry, onNext }: {
  questionText: string; isCorrect: boolean; isLoading: boolean; isLastQuestion: boolean;
  onRetry: () => void; onNext: () => void;
}) {
  const { t, locale } = useLanguage();
  const copy = analysisText[locale];
  return <section aria-labelledby="analysis-retry-title" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6" data-retry-card>
    <h3 id="analysis-retry-title" className="font-semibold">{isCorrect ? (isLastQuestion ? copy.finish : t.result.nextTask) : copy.retry}</h3>
    {!isCorrect && <>
      <MathText className="analysis-question" content={choiceStem(questionText.replace(/\[GEOMETRY:[\s\S]*?\]/g, ""))} />
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{copy.retryDescription}</p>
    </>}
    <div className="flex flex-col gap-3 sm:flex-row">
      {!isCorrect && <Button type="button" onClick={onRetry} disabled={isLoading} className="min-h-11 gap-2 px-5">
        <RotateCcw aria-hidden="true" className="h-4 w-4" />{copy.solve}<ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>}
      <Button type="button" variant={isCorrect ? "default" : "outline"} onClick={onNext} disabled={isLoading} className="min-h-11 gap-2 px-5">
        {isLastQuestion ? copy.finish : t.result.nextTask}<ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  </section>;
}
