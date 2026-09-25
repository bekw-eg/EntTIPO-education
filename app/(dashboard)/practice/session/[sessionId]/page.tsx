"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import QuestionCard from "@/components/practice/QuestionCard";
import ResultAnalysis from "@/components/practice/ResultAnalysis";
import SessionSummary from "@/components/practice/SessionSummary";
import { toast } from "sonner";
import { Question, AttemptResult } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Phase = "loading" | "answering" | "result" | "summary";

function PracticeSessionContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const sessionId = params.sessionId as string;
  const questionIdsParam = searchParams.get("questionIds");
  const questionIds = questionIdsParam ? questionIdsParam.split(",") : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<Question | null>(null);
  const [stepAnswers, setStepAnswers] = useState<Record<string, string>>({});
  const [lastAttemptResult, setLastAttemptResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionStats, setSessionStats] = useState({
    totalCount: questionIds.length || 0,
    correctCount: 0,
    completedCount: 0,
    mode: "mixed",
  });

  const fetchQuestion = async (index: number) => {
    if (!sessionId || questionIds.length === 0 || index >= questionIds.length) {
      setPhase("summary");
      return;
    }
    setPhase("loading");
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/next-question?questionIds=${questionIdsParam}&index=${index}`
      );
      if (!res.ok) {
        throw new Error("Failed to load question");
      }
      const data = await res.json();
      setQuestion(data);
      setStepAnswers({});
      setLastAttemptResult(null);
      setStartTime(Date.now());
      setPhase("answering");
    } catch (error) {
      console.error(error);
      toast.error(t.session.emptyListToast);
    }
  };

  useEffect(() => {
    if (questionIds.length > 0) {
      fetchQuestion(0);
    } else {
      toast.error(t.session.emptyListToast);
      router.push("/practice");
    }
  }, [sessionId, questionIdsParam]);

  const handleStepAnswer = (stepId: string, answer: string) => {
    setStepAnswers((prev) => ({ ...prev, [stepId]: answer }));
  };

  const handleSubmit = async () => {
    if (!question) return;
    setIsLoading(true);

    const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const stepAnswersList = Object.entries(stepAnswers).map(([stepId, answer]) => ({
      stepId,
      answer,
    }));

    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          sessionId,
          stepAnswers: stepAnswersList,
          timeSpent,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error submitting solution");
      }

      const result: AttemptResult = await res.json();
      setLastAttemptResult(result);

      setSessionStats((prev) => ({
        ...prev,
        completedCount: prev.completedCount + 1,
        correctCount: result.isCorrect ? prev.correctCount + 1 : prev.correctCount,
      }));

      setPhase("result");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to check solution");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setStepAnswers({});
    setLastAttemptResult(null);
    setStartTime(Date.now());
    setPhase("answering");
  };

  const handleNext = async () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questionIds.length) {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      } catch (e) {
        console.error("Failed to complete session", e);
      }
      setPhase("summary");
    } else {
      setCurrentIndex(nextIdx);
      fetchQuestion(nextIdx);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {phase === "loading" && (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">{t.session.loadingTask}</p>
        </div>
      )}

      {phase === "answering" && question && (
        <QuestionCard
          question={question}
          stepAnswers={stepAnswers}
          onStepAnswer={handleStepAnswer}
          onSubmit={handleSubmit}
          currentIndex={currentIndex}
          totalCount={questionIds.length}
          isLoading={isLoading}
        />
      )}

      {phase === "result" && lastAttemptResult && question && (
        <ResultAnalysis
          result={lastAttemptResult}
          question={question}
          onRetry={handleRetry}
          onNext={handleNext}
        />
      )}

      {phase === "summary" && (
        <SessionSummary
          session={sessionStats}
          onGoToDashboard={() => router.push("/")}
          onNewSession={() => router.push("/practice")}
        />
      )}
    </div>
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">...</div>}>
      <PracticeSessionContent />
    </Suspense>
  );
}
