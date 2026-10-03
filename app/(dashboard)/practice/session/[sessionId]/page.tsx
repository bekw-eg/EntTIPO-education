"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import QuestionCard from "@/components/practice/QuestionCard";
import ResultAnalysis from "@/components/practice/ResultAnalysis";
import SessionSummary from "@/components/practice/SessionSummary";
import { toast } from "sonner";
import { Question, AttemptResult, AiAction, SessionStats } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";
import { createSubmissionId } from "@/lib/client-submission";

type Phase = "loading" | "answering" | "result" | "summary";
interface Submission {
  submissionId: string;
  sessionId: string;
  questionId: string;
  stepAnswers: { stepId: string; answer: string }[];
  timeSpent: number;
  usedHint: boolean;
}

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
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | undefined>(undefined);
  const submittingRef = useRef(false);
  const pendingSubmission = useRef<Submission | null>(null);
  const hintedQuestions = useRef(new Set<string>());
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalCount: questionIds.length || 0,
    correctCount: 0,
    completedCount: 0,
    attemptCount: 0,
    correctAttemptCount: 0,
    mode: "mixed",
  });

  const handleHintUsed = useCallback((questionId: string) => {
    hintedQuestions.current.add(questionId);
  }, []);

  const handleRevealHint = async () => {
    if (!question || submittingRef.current) throw new Error(t.session.hintError);
    const res = await fetch(`/api/sessions/${sessionId}/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id }),
    });
    if (!res.ok) throw new Error(t.session.hintError);
    handleHintUsed(question.id);
  };

  const handleOpenAi = (action?: AiAction) => {
    setAiAction(action);
    setIsAiOpen(true);
  };

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
      pendingSubmission.current = null;
      if (data.usedHint) handleHintUsed(data.id);
      setIsAiOpen(false);
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
    if (submittingRef.current) return;
    pendingSubmission.current = null;
    setStepAnswers((prev) => ({ ...prev, [stepId]: answer }));
  };

  const handleSubmit = async () => {
    if (!question || submittingRef.current || phase !== "answering") return;
    submittingRef.current = true;
    setIsLoading(true);

    // Keep the entire payload on network failure, including timing and hint state.
    // A repeated click retries this submission; a deliberate new answer gets a new ID.
    try {
      const submission = pendingSubmission.current ?? {
        submissionId: createSubmissionId(),
        sessionId,
        questionId: question.id,
        stepAnswers: Object.entries(stepAnswers).map(([stepId, answer]) => ({ stepId, answer })),
        timeSpent: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
        usedHint: hintedQuestions.current.has(question.id),
      };
      pendingSubmission.current = submission;

      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error submitting solution");
      }

      const result: AttemptResult = await res.json();
      setLastAttemptResult(result);

      setSessionStats(result.sessionStats);

      setPhase("result");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to check solution");
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    pendingSubmission.current = null;
    setStepAnswers({});
    setLastAttemptResult(null);
    setStartTime(Date.now());
    setPhase("answering");
  };

  const handleNext = async () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questionIds.length) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        if (!res.ok) throw new Error("Failed to complete session");
        setSessionStats(await res.json());
      } catch (e) {
        console.error("Failed to complete session", e);
        toast.error(t.session.completionError);
        return;
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
          onOpenAi={handleOpenAi}
          onRevealHint={handleRevealHint}
        />
      )}

      {phase === "result" && lastAttemptResult && question && (
        <ResultAnalysis
          result={lastAttemptResult}
          question={question}
          onRetry={handleRetry}
          onNext={handleNext}
          onOpenAi={handleOpenAi}
        />
      )}

      {phase === "summary" && (
        <SessionSummary
          session={sessionStats}
          onGoToDashboard={() => router.push("/")}
          onNewSession={() => router.push("/practice")}
        />
      )}

      <AiTutorPanel
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        question={question}
        stepAnswers={stepAnswers}
        hasAttempted={phase === "result"}
        attemptId={lastAttemptResult?.attemptId}
        sessionId={sessionId}
        onHintUsed={handleHintUsed}
        initialAction={aiAction}
      />
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
