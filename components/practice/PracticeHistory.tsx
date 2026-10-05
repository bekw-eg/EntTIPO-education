"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/ui/MathText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { contentText } from "@/lib/i18n/content";
import { ChoiceMath } from "./ChoiceMath";
import type { AttemptResult } from "@/types";

type HistoryAttempt = { id: string; isCorrect: boolean; attemptNumber: number;
  submissionResult: AttemptResult | null; question: { title: string; titleKk?: string; correctAnswer: string; explanation: string; explanationKk?: string };
  stepAnswers: { id: string; answer: string }[] };
export function PracticeHistory({ sessionId }: { sessionId: string }) {
  const { t, locale } = useLanguage();
  const [attempts, setAttempts] = useState<HistoryAttempt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = async () => {
    setBusy(true); setFailed(false);
    try {
      const response = await fetch(`/api/attempts?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setAttempts(await response.json());
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  return <div className="space-y-3">
    {!attempts && <Button variant="outline" disabled={busy} onClick={() => void load()}>
      {locale === "kk" ? "Жауаптар тарихын қарау" : "Просмотреть историю ответов"}
    </Button>}
    {failed && <p role="alert">{t.session.loadError}</p>}
    {attempts?.map(attempt => {
      const result = attempt.submissionResult, choice = result?.choice;
      return <details key={attempt.id} className="border rounded-xl p-4 space-y-3">
        <summary className="cursor-pointer font-semibold">{attempt.isCorrect ? "✓" : "✗"} {contentText(attempt.question.title, attempt.question.titleKk, locale)} · {attempt.attemptNumber}</summary>
        {choice ? [
          { title: t.result.yourAnswer, ids: choice.selectedOptionIds }, { title: t.result.correctAnswer, ids: choice.correctOptionIds },
        ].map(group => <div key={group.title}><p className="font-semibold">{group.title}</p>
          {choice.options.filter(o => group.ids.includes(o.id)).map(o => <div key={o.id} className="flex items-center gap-2">
            <strong>{String.fromCharCode(65+choice.options.findIndex(v=>v.id===o.id))}.</strong>
            <ChoiceMath text={contentText(o.text,o.textKk,locale)} />
          </div>)}
        </div>) : <>
          <p>{t.result.yourAnswer}</p>{attempt.stepAnswers.map(answer=><ChoiceMath key={answer.id} text={answer.answer} />)}
          <p>{t.result.correctAnswer}</p><ChoiceMath text={result?.correctAnswer ?? attempt.question.correctAnswer} />
        </>}
        <MathText content={contentText(result?.explanation ?? attempt.question.explanation, result?.explanationKk ?? attempt.question.explanationKk, locale)} />
      </details>;
    })}
  </div>;
}
