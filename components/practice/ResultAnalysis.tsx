"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttemptResult, PracticeQuestion, AiAction } from "@/types";
import { learningText } from "@/lib/i18n/learning";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { contentText } from "@/lib/i18n/content";
import { choiceStem } from "@/lib/choiceDisplay";
import { resultReview } from "@/lib/resultAnalysis";
import { MathText } from "@/components/ui/MathText";
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";
import { ChoiceMath } from "./ChoiceMath";
import { ResultSummary } from "./ResultSummary";
import { MistakeCard } from "./MistakeCard";
import { RuleReviewCard } from "./RuleReviewCard";
import { RetryCard } from "./RetryCard";

interface ResultAnalysisProps {
  result: AttemptResult; question: PracticeQuestion; isLoading?: boolean;
  onRetry: () => void; onNext: () => void; onOpenAi?: (action?: AiAction) => void;
  questionNumber?: number; isLastQuestion?: boolean;
}

export default function ResultAnalysis({ result, question, onRetry, onNext, onOpenAi, isLoading = false,
  questionNumber = 1, isLastQuestion = false }: ResultAnalysisProps) {
  const { t, getTopicName, locale } = useLanguage();
  const learningCopy = learningText[locale === "kk" ? "kk" : "ru"];
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const review = resultReview(result, question, locale);
  const questionText = contentText(question.questionText, question.questionTextKk, locale);
  const items = result.isCorrect ? review.items : review.failed;
  const topic = question.topic?.name ? getTopicName(question.topic.name) : contentText(question.title, question.titleKk, locale);

  return <div className="analysis-content mx-auto min-w-0 max-w-2xl space-y-5 sm:space-y-6" data-result-analysis>
    <ResultSummary topic={topic} isCorrect={result.isCorrect} isPartial={result.isPartial}
      failedCount={review.failed.length} isChoice={!!result.choice} insight={review.sharedFeedback} hasUnclassified={review.hasUnclassified} />
    {items.map(item => <MistakeCard key={item.id} item={item} questionNumber={questionNumber}
      questionText={questionText} latex={question.latex} stepLabel={!result.choice ? `${t.result.stepItem} ${item.order}` : undefined}
      explanation={item.feedback !== review.sharedFeedback ? item.feedback : undefined}>
      {!!result.choice?.solutionSteps.length && <ol className="space-y-4" aria-label={t.session.solutionSteps}>
        {result.choice.solutionSteps.map((step, index) => <li key={index} className="flex min-w-0 gap-3">
          <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <MathText className="analysis-copy" content={choiceStem(contentText(step.prompt, step.promptKk, locale))} />
            <div className="overflow-x-auto py-2"><ChoiceMath text={step.answer} /></div>
          </div>
        </li>)}
      </ol>}
    </MistakeCard>)}
    <RuleReviewCard rules={review.rules} explanation={review.explanation} />
    {result.learningCheck && <div role="status" className="space-y-2 rounded-2xl border bg-card p-4 text-sm sm:p-5">
      <p className="font-semibold">{result.learningCheck.status === "passed" ? learningCopy.success : learningCopy.failed}</p>
      {result.learningCheck.status !== "passed" && <p>{learningCopy.retry}</p>}
      {result.learningCheck.dueDay && <p>{learningCopy.next}: {result.learningCheck.dueDay}</p>}
      <Link className="inline-flex min-h-11 items-center text-primary underline" href="/">{learningCopy.home}</Link>
    </div>}
    {!result.isCorrect && <Button type="button" variant="ghost" disabled={isLoading} className="min-h-11 w-full gap-2 whitespace-normal sm:w-auto"
      onClick={() => onOpenAi ? onOpenAi("analyze_error") : setLocalAiOpen(true)}>
      <Bot aria-hidden="true" className="h-4 w-4 shrink-0" />{t.ai.reviewWithAi}
    </Button>}
    <RetryCard questionText={questionText} isCorrect={result.isCorrect} isLoading={isLoading} isLastQuestion={isLastQuestion}
      onRetry={onRetry} onNext={onNext} />
    {!onOpenAi && <AiTutorPanel isOpen={localAiOpen} onClose={() => setLocalAiOpen(false)} question={question}
      attemptId={result.attemptId} hasAttempted initialAction="analyze_error" />}
  </div>;
}
