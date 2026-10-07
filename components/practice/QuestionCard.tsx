"use client";

import React, { useEffect, useState } from "react";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { Timer, CheckCircle, Lightbulb, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PracticeQuestion, AiAction } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { contentText } from '@/lib/i18n/content';
import { MathText } from '@/components/ui/MathText';
import { GeometryViewer, GeometryConfig } from "@/components/ui/GeometryViewer";
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";
import { toast } from "sonner";
import { ChoiceMath } from "./ChoiceMath";
import { choiceStem } from "@/lib/choiceDisplay";

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
  question: PracticeQuestion;
  stepAnswers: Record<string, string>;
  onStepAnswer: (stepId: string, answer: string) => void;
  onSubmit: () => void;
  currentIndex: number;
  totalCount: number;
  isLoading: boolean;
  onOpenAi?: (action?: AiAction) => void;
  onRevealHint?: () => Promise<Record<string, string>>;
  answersLocked?: boolean;
  startedAt?: number;
  assistanceDisabled?: boolean;
  submitLabel?: string;
}

export default function QuestionCard({
  question,
  stepAnswers,
  onStepAnswer,
  onSubmit,
  currentIndex,
  totalCount,
  isLoading,
  onOpenAi,
  onRevealHint,
  answersLocked = false,
  startedAt,
  assistanceDisabled = false,
  submitLabel,
}: QuestionCardProps) {
  const { t, getTopicName, locale } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const [localInitialAction, setLocalInitialAction] = useState<AiAction | undefined>(undefined);
  const [revealedHints, setRevealedHints] = useState<Record<string, string>>({});
  const [isRevealingHint, setIsRevealingHint] = useState(false);
  const revealingRef = React.useRef(false);

  const revealHint = async (stepId: string) => {
    if (revealingRef.current || isLoading) return;
    revealingRef.current = true;
    setIsRevealingHint(true);
    try {
      const hints = await onRevealHint?.();
      if (hints?.[stepId]) setRevealedHints((prev) => ({ ...prev, [stepId]: hints[stepId] }));
    } catch {
      toast.error(t.session.hintError);
    } finally {
      revealingRef.current = false;
      setIsRevealingHint(false);
    }
  };

  const handleOpenAi = (action?: AiAction) => {
    if (onOpenAi) {
      onOpenAi(action);
    } else {
      setLocalInitialAction(action);
      setLocalAiOpen(true);
    }
  };

  useEffect(() => {
    const start = startedAt ?? Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    setRevealedHints(Object.fromEntries(question.steps.filter((step) => step.hint).map((step) => [step.id, step.hint!])));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [question.id, startedAt]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((currentIndex + 1) / Math.max(totalCount, 1)) * 100;
  const isAllAnswered =
    question.steps?.length > 0 &&
    question.steps.every(
      (s) => s.type === "multiple_select" ? (() => { try { return JSON.parse(stepAnswers[s.id] || "[]").length > 0; } catch { return false; } })() :
        !!stepAnswers[s.id]?.trim()
    );

  const topicDisplay = question.topic?.name
    ? getTopicName(question.topic.name)
    : t.common.math;

  return (
    <Card className="overflow-hidden">
      {/* Session Progress bar */}
      <div className="h-1.5 w-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Top Header metadata */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium text-xs">
              {topicDisplay}
            </Badge>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
              <span>
                {t.session.taskOf} {currentIndex + 1} / {totalCount}
              </span>
              <div className="flex items-center gap-1 tabular-nums">
                <Timer className="w-3.5 h-3.5 text-primary" />
                {formatTime(elapsed)}
              </div>
            </div>
          </div>
        </div>

        {/* Question Title & Text */}
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            {contentText(question.title, question.titleKk, locale)}
          </h2>
          {question.questionText && (
              <div className="text-sm sm:text-base text-foreground/90 whitespace-pre-line">
                <MathText content={choiceStem(contentText(question.questionText, question.questionTextKk, locale).replace(/\[GEOMETRY:[\s\S]*?\]/g, ''))} />
              </div>
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
            <div className="math-block text-center">
              <MathDisplay math={question.latex} block />
            </div>
          )}
        </div>

        {/* Steps Section */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 bg-primary rounded-full inline-block" />
            <h3 className="font-medium text-sm text-muted-foreground">
              {question.choiceFormat ? t.session.choiceAnswers : t.session.solutionSteps}
            </h3>
          </div>

          <div className="space-y-5">
            {question.steps?.map((step, idx) => {
              const currentVal = stepAnswers[step.id] || "";
              const instruction = question.choiceFormat && locale === "en" ? step.type === "multiple_select"
                ? "Select all correct answers" : "Select one correct answer" : contentText(step.prompt, step.promptKk, locale);

              return (
                <div
                  key={step.id}
                  className="min-w-0 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm sm:text-base">
                      {!question.choiceFormat && <span className="text-primary font-bold mr-2">
                        {t.session.step} {idx + 1}:
                      </span>}
                      {instruction}
                    </p>
                    {currentVal && (
                      <CheckCircle aria-hidden="true" className="w-4 h-4 text-primary shrink-0 mt-1" />
                    )}
                  </div>

                  {revealedHints[step.id] ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <MathText content={contentText(revealedHints[step.id], step.hintKk, locale)} />
                    </div>
                  ) : step.hasHint && !assistanceDisabled ? (
                    <Button type="button" variant="ghost" size="sm"
                      disabled={isLoading || isRevealingHint}
                      onClick={() => revealHint(step.id)}>
                      <Lightbulb className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      {t.session.hint}
                    </Button>
                  ) : null}

                  {/* Multiple Choice */}
                  {(step.type === "multiple_choice" || step.type === "multiple_select") && (
                    <fieldset aria-label={instruction} className="grid grid-cols-1 gap-2 pt-1">
                      {step.options?.map((opt, optionIndex) => {
                        let selectedIds: string[] = [];
                        try { selectedIds = JSON.parse(currentVal || "[]"); } catch { /* single choice */ }
                        const isSelected = step.type === "multiple_select" ? selectedIds.includes(opt.id) : currentVal === opt.id;
                        return (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-3 min-h-14 p-4 cursor-pointer text-left rounded-md text-sm border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5 text-primary font-medium"
                                : "border-border hover:border-primary/30 hover:bg-muted/40"
                            }`}
                          >
                            <input type={step.type === "multiple_select" ? "checkbox" : "radio"} name={step.id} value={opt.id}
                              checked={isSelected} disabled={isLoading || answersLocked}
                              className="h-5 w-5 accent-primary shrink-0"
                              onChange={() => onStepAnswer(step.id, step.type === "multiple_select"
                                ? JSON.stringify((isSelected ? selectedIds.filter(id => id !== opt.id) : [...selectedIds, opt.id]).sort()) : opt.id)} />
                            <span className="font-mono text-xs opacity-60 mr-2">
                              {String.fromCharCode(65 + optionIndex)}.
                            </span>
                            <div className="min-w-0 flex-1 overflow-x-auto py-1"><ChoiceMath text={contentText(opt.text, opt.textKk, locale)} /></div>
                          </label>
                        );
                      })}
                    </fieldset>
                  )}

                  {/* Numeric Input */}
                  {step.type === "numeric_input" && (
                    <div className="pt-1 max-w-xs">
                      <Input
                        aria-label={instruction}
                        type="text"
                        value={currentVal}
                        disabled={isLoading || answersLocked}
                        maxLength={2000}
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
                        aria-label={instruction}
                        type="text"
                        value={currentVal}
                        disabled={isLoading || answersLocked}
                        maxLength={2000}
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
        <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {question.choiceFormat ? t.session.chooseBeforeCheck : t.session.fillAllSteps}
            </p>
            {!assistanceDisabled && <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenAi()}
              className="text-xs text-muted-foreground"
              disabled={isLoading || isRevealingHint}
            >
              <Bot className="w-3.5 h-3.5 mr-1" />
              {t.ai.assistantBtn}
            </Button>}
          </div>
          <Button
            onClick={onSubmit}
            disabled={isLoading || isRevealingHint || !isAllAnswered}
            size="lg"
            className="px-8 font-semibold shadow-xs"
          >
            {isLoading ? t.session.checking : submitLabel ?? (question.choiceFormat ? t.session.checkAnswer : t.session.checkSolution)}
          </Button>
        </div>
      </CardContent>

      {!onOpenAi && !assistanceDisabled && (
        <AiTutorPanel
          isOpen={localAiOpen}
          onClose={() => setLocalAiOpen(false)}
          question={question}
          stepAnswers={stepAnswers}
          initialAction={localInitialAction}
        />
      )}
    </Card>
  );
}
