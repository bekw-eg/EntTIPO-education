"use client";

import React, { useEffect, useState } from "react";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { Timer, CheckCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Question } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { GeometryViewer, GeometryConfig } from "@/components/ui/GeometryViewer";

function tryParseGeometry(text: string): GeometryConfig | null {
  try {
    const match = text.match(/\[GEOMETRY:([\s\S]*?)\]/);
    if (match && match[1]) {
      return JSON.parse(match[1]) as GeometryConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

interface QuestionCardProps {
  question: Question;
  stepAnswers: Record<string, string>;
  onStepAnswer: (stepId: string, answer: string) => void;
  onSubmit: () => void;
  currentIndex: number;
  totalCount: number;
  isLoading: boolean;
}

export default function QuestionCard({
  question,
  stepAnswers,
  onStepAnswer,
  onSubmit,
  currentIndex,
  totalCount,
  isLoading,
}: QuestionCardProps) {
  const { t, getTopicName } = useLanguage();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [question.id]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((currentIndex + 1) / Math.max(totalCount, 1)) * 100;
  const isAllAnswered =
    question.steps?.length > 0 &&
    question.steps.every(
      (s) => stepAnswers[s.id] && stepAnswers[s.id].trim().length > 0
    );

  const topicDisplay = question.topic?.name
    ? getTopicName(question.topic.name)
    : t.common.math;

  return (
    <Card className="shadow-sm overflow-hidden border">
      {/* Session Progress bar */}
      <div className="h-1.5 w-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Top Header metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-medium text-xs">
              {topicDisplay}
            </Badge>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-muted-foreground mr-1">
                {t.session.difficulty}:
              </span>
              {[1, 2, 3, 4, 5].map((d) => (
                <div
                  key={d}
                  className={`w-2 h-2 rounded-full ${
                    d <= (question.difficulty || 1)
                      ? "bg-amber-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t.session.taskOf} {currentIndex + 1} / {totalCount}
            </span>
            <div className="flex items-center gap-1 font-mono bg-muted/60 px-2 py-1 rounded">
              <Timer className="w-3.5 h-3.5 text-primary" />
              {formatTime(elapsed)}
            </div>
          </div>
        </div>

        {/* Question Title & Text */}
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            {question.title}
          </h2>
          {question.questionText && (
            <p className="text-sm sm:text-base text-foreground/90 whitespace-pre-line">
              {question.questionText}
            </p>
          )}

          {/* Interactive Geometric Drawing (if present) */}
          {(() => {
            const geom =
              (question as any).geometryConfig ||
              (question.latex?.includes("[GEOMETRY:")
                ? tryParseGeometry(question.latex)
                : question.questionText?.includes("[GEOMETRY:")
                ? tryParseGeometry(question.questionText)
                : null);

            if (geom) {
              return (
                <div className="my-4">
                  <GeometryViewer config={geom} />
                </div>
              );
            }
            return null;
          })()}

          {question.latex && !question.latex.startsWith("[GEOMETRY:") && (
            <div className="my-3 p-4 bg-muted/30 rounded-xl border text-center overflow-x-auto">
              <MathDisplay math={question.latex} block />
            </div>
          )}
        </div>

        {/* Steps Section */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 bg-primary rounded-full inline-block" />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              {t.session.solutionSteps}
            </h3>
          </div>

          <div className="space-y-5">
            {question.steps?.map((step, idx) => {
              const currentVal = stepAnswers[step.id] || "";

              return (
                <div
                  key={step.id}
                  className="p-4 rounded-xl border bg-card/60 space-y-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm sm:text-base">
                      <span className="text-primary font-bold mr-2">
                        {t.session.step} {idx + 1}:
                      </span>
                      {step.prompt}
                    </p>
                    {currentVal && (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                    )}
                  </div>

                  {step.hint && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{step.hint}</span>
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {step.type === "multiple_choice" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {step.options?.map((opt) => {
                        const isSelected =
                          currentVal === opt.id || currentVal === opt.text;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onStepAnswer(step.id, opt.text)}
                            className={`p-3 text-left rounded-lg text-sm border transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                                : "border-border hover:border-primary/30 hover:bg-muted/40"
                            }`}
                          >
                            <span className="font-mono text-xs opacity-60 mr-2">
                              {String.fromCharCode(65 + opt.order)}.
                            </span>
                            {opt.text}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Numeric Input */}
                  {step.type === "numeric_input" && (
                    <div className="pt-1 max-w-xs">
                      <Input
                        type="text"
                        value={currentVal}
                        onChange={(e) => onStepAnswer(step.id, e.target.value)}
                        placeholder={t.session.inputNumberPlaceholder}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Expression Input */}
                  {step.type === "expression_input" && (
                    <div className="pt-1 space-y-1.5">
                      <Input
                        type="text"
                        value={currentVal}
                        onChange={(e) => onStepAnswer(step.id, e.target.value)}
                        placeholder={t.session.inputExpressionPlaceholder}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.session.powerHint}: <code className="bg-muted px-1 rounded">x^2</code>,
                        {" "}{t.session.multHint}: <code className="bg-muted px-1 rounded">2*x</code>,
                        {" "}{t.session.sqrtHint}: <code className="bg-muted px-1 rounded">sqrt(x)</code>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Footer */}
        <div className="pt-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t.session.fillAllSteps}
          </p>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !isAllAnswered}
            size="lg"
            className="px-8 font-semibold shadow-xs"
          >
            {isLoading ? t.session.checking : t.session.checkSolution}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
