"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Bot,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AttemptResult, Question, AiAction } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";

interface ResultAnalysisProps {
  result: AttemptResult;
  question: Question;
  onRetry: () => void;
  onNext: () => void;
  onOpenAi?: (action?: AiAction) => void;
}

export default function ResultAnalysis({
  result,
  question,
  onRetry,
  onNext,
  onOpenAi,
}: ResultAnalysisProps) {
  const { t, getErrorLabel } = useLanguage();
  const [showExplanation, setShowExplanation] = useState(false);
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const isFull = result.isCorrect;
  const isPartial = result.isPartial;

  const handleOpenAi = (action?: AiAction) => {
    if (onOpenAi) {
      onOpenAi(action);
    } else {
      setLocalAiOpen(true);
    }
  };

  return (
    <Card className="shadow-md overflow-hidden border animate-slide-in">
      {/* Status banner */}
      <div
        className={`p-6 text-center border-b ${
          isFull
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            : isPartial
            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
        }`}
      >
        <div className="flex justify-center mb-3">
          {isFull ? (
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          ) : isPartial ? (
            <AlertTriangle className="w-14 h-14 text-amber-500" />
          ) : (
            <XCircle className="w-14 h-14 text-rose-500" />
          )}
        </div>
        <h2 className="text-2xl font-bold">
          {isFull
            ? t.result.greatJob
            : isPartial
            ? `${t.result.partialJob} (${result.score}%)`
            : t.result.hasErrors}
        </h2>
        <p className="text-sm mt-1 text-muted-foreground">
          {isFull ? t.result.allCorrectDesc : t.result.hasErrorsDesc}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {result.errorType && (
            <Badge variant="destructive" className="text-xs">
              {t.result.errorTypeLabel}: {getErrorLabel(result.errorType)}
            </Badge>
          )}

          {!isFull && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenAi("analyze_error")}
              className="h-7 text-xs border-primary/40 bg-background/90 hover:bg-primary/10 text-primary font-semibold shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5 mr-1" />
              {t.ai.reviewWithAi}
            </Button>
          )}
        </div>
      </div>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Step-by-step review */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            {t.result.stepAnalysis}
          </h3>

          <div className="space-y-3">
            {result.stepResults?.map((sr) => {
              const step = question.steps?.find((s) => s.id === sr.stepId);
              return (
                <div
                  key={sr.stepId}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                    sr.isCorrect
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-rose-500/5 border-rose-500/30"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {sr.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      <span className="font-bold mr-1">
                        {t.result.stepItem} {sr.stepOrder}:
                      </span>
                      {step?.prompt || "..."}
                    </p>
                    <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <span>
                        {t.result.yourAnswer}{" "}
                        <strong className="font-mono text-foreground">
                          {sr.userAnswer || "—"}
                        </strong>
                      </span>
                      {!sr.isCorrect && (
                        <span className="text-rose-600 dark:text-rose-400">
                          {t.result.correctAnswer}{" "}
                          <strong className="font-mono">
                            {sr.expectedAnswer}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        <div className="rounded-xl border p-4 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">
                {t.result.solutionExplanation}
              </h4>
            </div>
            {!showExplanation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(true)}
              >
                {t.result.show}
              </Button>
            )}
          </div>

          {(showExplanation || isFull) && (
            <p className="text-sm text-foreground/90 whitespace-pre-line pt-2 border-t mt-2">
              {question.explanation}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
          {!isFull && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenAi("analyze_error")}
                className="w-full sm:w-auto border-primary/40 text-primary hover:bg-primary/10 font-semibold"
              >
                <Bot className="w-4 h-4 mr-2" />
                {t.ai.reviewWithAi}
              </Button>

              <Button
                variant="outline"
                onClick={onRetry}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t.result.tryAgain}
              </Button>
            </>
          )}
          <Button onClick={onNext} className="w-full sm:w-auto px-6 font-semibold">
            {t.result.nextTask}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>

      {!onOpenAi && (
        <AiTutorPanel
          isOpen={localAiOpen}
          onClose={() => setLocalAiOpen(false)}
          question={question}
          attemptId={result.attemptId}
          hasAttempted={true}
          initialAction="analyze_error"
        />
      )}
    </Card>
  );
}
