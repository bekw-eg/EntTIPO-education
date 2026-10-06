"use client";

import { BookOpen } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { analysisText } from "@/lib/i18n/result-analysis";
import { choiceStem } from "@/lib/choiceDisplay";

export function RuleReviewCard({ rules, explanation }: { rules: { id: string; name: string; text: string }[]; explanation: string }) {
  const { locale } = useLanguage();
  const copy = analysisText[locale];
  if (!rules.length && !explanation) return null;
  return <section aria-labelledby="analysis-rule-title" className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6" data-rule-review>
    <h3 id="analysis-rule-title" className="flex items-center gap-2 font-semibold">
      <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />{copy.rule}
    </h3>
    {rules.map(rule => <div key={rule.id} className="space-y-2">
      {rules.length > 1 && <h4 className="text-sm font-semibold">{rule.name}</h4>}
      <MathText className="analysis-copy" content={choiceStem(rule.text)} />
    </div>)}
    {explanation && <div className={rules.length ? "space-y-2 border-t pt-4" : "space-y-2"}>
      {rules.length > 0 && <h4 className="text-sm font-semibold text-muted-foreground">{copy.example}</h4>}
      <MathText className="analysis-copy" content={choiceStem(explanation)} />
    </div>}
  </section>;
}
