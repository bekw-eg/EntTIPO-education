"use client";
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import QuestionCard from "@/components/practice/QuestionCard";
import ResultAnalysis from "@/components/practice/ResultAnalysis";
import SessionSummary from "@/components/practice/SessionSummary";
import { PracticeHistory } from "@/components/practice/PracticeHistory";
import Link from "next/link";
import { roadText } from "@/lib/i18n/learning-road";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/AccountProvider";
import { toast } from "sonner";
import { PracticeSnapshot, AiAction } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { errorText } from '@/lib/i18n/messages';
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";
import { createSubmissionId } from "@/lib/client-submission";
import { PracticeDraft, clearPracticeDraft, readPracticeDraft, sameAnswers, writePracticeDraft } from "@/lib/client-practice";

type Phase = "loading" | "answering" | "result" | "summary" | "error";

function PracticeSessionContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAccount();
  const { t, locale } = useLanguage();
  const sessionId = params.sessionId as string;
  const userId = user?.id;
  const [snapshot, setSnapshot] = useState<PracticeSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [stepAnswers, setStepAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "local">("saved");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | undefined>();
  const draftRef = useRef<PracticeDraft | null>(null);
  const snapshotRef = useRef<PracticeSnapshot | null>(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const savingRef = useRef<Promise<void> | null>(null);
  const aliveRef = useRef(true);
  const backedUpRef = useRef(true);
  const hintedQuestions = useRef(new Set<string>());

  const backup = () => {
    if (draftRef.current) backedUpRef.current = writePracticeDraft(draftRef.current);
  };

  const applySnapshot = (data: PracticeSnapshot, recoverLocal = false) => {
    if (!aliveRef.current) return;
    snapshotRef.current = data;
    const local = userId && recoverLocal ? readPracticeDraft(userId, data) : null;
    const answers = local?.answers ?? data.draftAnswers;
    dirtyRef.current = !!local && !sameAnswers(answers, data.draftAnswers);
    if (userId && data.status === "active" && data.question && !data.result) {
      draftRef.current = local ?? {
        version: 1, userId, sessionId, questionId: data.question.id,
        currentIndex: data.currentIndex, revision: data.revision, answers,
        startedAt: Date.now(), pendingSubmission: null,
      };
      backup();
    } else {
      draftRef.current = null;
      if (userId) clearPracticeDraft(userId, sessionId);
    }
    if (data.question?.usedHint) hintedQuestions.current.add(data.question.id);
    setSnapshot(data);
    setStepAnswers(answers);
    setHasPendingSubmission(!!draftRef.current?.pendingSubmission);
    setSaveStatus(dirtyRef.current ? "local" : "saved");
    setIsAiOpen(false);
    setPhase(data.status === "completed" ? "summary" : data.result ? "result" : data.question ? "answering" : "error");
  };

  const loadSession = async (recoverLocal = true) => {
    const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
    if (res.status === 401) router.replace("/login");
    if (!res.ok) throw new Error(t.session.loadError);
    applySnapshot(await res.json(), recoverLocal);
  };

  // Serialize writes and keep edits made during a request in the next write.
  const flushDraft = (): Promise<void> => {
    if (savingRef.current) return savingRef.current;
    const save = async () => {
      try {
        while (dirtyRef.current && draftRef.current) {
          const draft = draftRef.current;
          const answers = { ...draft.answers };
          draft.sentAnswers = [...(draft.sentAnswers ?? []), answers].slice(-10);
          backup();
          if (aliveRef.current) setSaveStatus("saving");
          const res = await fetch(`/api/sessions/${sessionId}/state`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save", revision: draft.revision, currentIndex: draft.currentIndex, answers }),
          });
          if (res.status === 409) {
            // Also recovers an acknowledged write whose network response was lost.
            await loadSession(true);
            toast.info(t.session.stateChanged);
            continue;
          }
          if (!res.ok) throw new Error(t.session.saveError);
          const saved = await res.json();
          if (!aliveRef.current) return;
          draft.revision = saved.revision;
          draft.sentAnswers = undefined;
          if (snapshotRef.current) snapshotRef.current.revision = saved.revision;
          dirtyRef.current = !sameAnswers(draft.answers, answers);
          backup();
        }
        if (aliveRef.current) setSaveStatus("saved");
      } catch (error) {
        if (aliveRef.current) setSaveStatus("local");
        throw error;
      }
    };
    const pending = save().finally(() => { savingRef.current = null; });
    savingRef.current = pending;
    return pending;
  };

  useEffect(() => {
    aliveRef.current = true;
    if (userId) loadSession(true).catch(() => { if (aliveRef.current) setPhase("error"); });
    const saveOnExit = () => {
      backup();
      const draft = draftRef.current;
      if (dirtyRef.current && draft && !savingRef.current) {
        draft.sentAnswers = [...(draft.sentAnswers ?? []), { ...draft.answers }].slice(-10);
        backup();
        void fetch(`/api/sessions/${sessionId}/state`, {
          method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", revision: draft.revision, currentIndex: draft.currentIndex, answers: draft.answers }),
        }).catch(() => {});
      }
    };
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !backedUpRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const retrySave = () => { if (dirtyRef.current) void flushDraft().catch(() => {}); };
    window.addEventListener("pagehide", saveOnExit);
    window.addEventListener("beforeunload", warnUnsaved);
    window.addEventListener("online", retrySave);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("pagehide", saveOnExit);
      window.removeEventListener("beforeunload", warnUnsaved);
      window.removeEventListener("online", retrySave);
    };
  }, [sessionId, userId]);

  useEffect(() => {
    if (phase !== "answering" || !dirtyRef.current || busyRef.current) return;
    const timer = setTimeout(() => { void flushDraft().catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [stepAnswers, phase]);

  const handleHintUsed = useCallback((questionId: string) => { hintedQuestions.current.add(questionId); }, []);

  const handleRevealHint = async (): Promise<Record<string, string>> => {
    const question = snapshotRef.current?.question;
    if (!question || busyRef.current) throw new Error(t.session.hintError);
    const res = await fetch(`/api/sessions/${sessionId}/hint`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id }),
    });
    if (!res.ok) throw new Error(t.session.hintError);
    handleHintUsed(question.id);
    return (await res.json()).hints;
  };

  const handleOpenAi = (action?: AiAction) => { setAiAction(action); setIsAiOpen(true); };

  const handleStepAnswer = (stepId: string, answer: string) => {
    const draft = draftRef.current;
    if (!draft || busyRef.current || draft.pendingSubmission) return;
    draft.answers = { ...draft.answers, [stepId]: answer };
    dirtyRef.current = true;
    backup(); // Synchronous: closing before the debounce cannot lose this edit.
    setStepAnswers(draft.answers);
    setSaveStatus("saving");
  };

  const handleSubmit = async () => {
    if (busyRef.current || phase !== "answering") return;
    busyRef.current = true;
    setIsLoading(true);
    try {
      const intendedDraft = draftRef.current;
      await flushDraft();
      const draft = draftRef.current;
      // A conflict may load another tab's draft. Let the student review it first.
      if (!draft || draft !== intendedDraft) return;
      draft.pendingSubmission ??= {
        submissionId: createSubmissionId(), sessionId, questionId: draft.questionId,
        stepAnswers: Object.entries(draft.answers).map(([stepId, answer]) => ({ stepId, answer })),
        timeSpent: Math.max(1, Math.round((Date.now() - draft.startedAt) / 1000)),
        usedHint: hintedQuestions.current.has(draft.questionId),
      };
      backup(); // Preserve the exact UUID and payload before sending any request.
      setHasPendingSubmission(true);
      const res = await fetch("/api/attempts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft.pendingSubmission),
      });
      if (!res.ok) {
        const error = await res.json();
        if (res.status === 400) {
          draft.pendingSubmission = null;
          backup();
          setHasPendingSubmission(false);
        }
        if (res.status === 409) await loadSession(true);
        throw new Error(error.error || t.session.submitError);
      }
      await loadSession(false);
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : t.session.submitError, locale));
    } finally { busyRef.current = false; setIsLoading(false); }
  };

  const transition = async (action: "retry" | "next") => {
    if (busyRef.current || !snapshotRef.current) return;
    busyRef.current = true;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/state`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: snapshotRef.current.revision }),
      });
      if (res.status === 409) { await loadSession(true); toast.info(t.session.stateChanged); return; }
      if (!res.ok) throw new Error(t.session.saveError);
      applySnapshot(await res.json());
    } catch { toast.error(t.session.saveError); }
    finally { busyRef.current = false; setIsLoading(false); }
  };

  const question = snapshot?.question;
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="md:hidden flex justify-end"><LanguageSwitcher variant="compact" /></div>
      {phase === "loading" && <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{t.session.loadingTask}</p>
      </div>}
      {phase === "error" && <div className="p-8 text-center space-y-4">
        <p>{t.session.loadError}</p>
        <Button onClick={() => { setPhase("loading"); void loadSession(true).catch(() => setPhase("error")); }}>{t.session.reload}</Button>
        <Button variant="outline" onClick={() => router.push("/practice")}>{t.common.back}</Button>
      </div>}
      {phase === "answering" && question && snapshot && <>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground text-right">
          {saveStatus === "saved" ? t.session.saved : saveStatus === "saving" ? t.session.saving : t.session.saveError}
        </p>
        {hasPendingSubmission && <p role="alert" className="text-sm text-amber-600">{t.session.pendingSubmission}</p>}
        <QuestionCard question={question} stepAnswers={stepAnswers} onStepAnswer={handleStepAnswer}
          onSubmit={handleSubmit} currentIndex={snapshot.currentIndex} totalCount={snapshot.totalCount}
          isLoading={isLoading} answersLocked={hasPendingSubmission} startedAt={draftRef.current?.startedAt}
          onOpenAi={handleOpenAi} onRevealHint={handleRevealHint} />
      </>}
      {phase === "result" && snapshot?.result && question && <ResultAnalysis
        result={snapshot.result} question={question} isLoading={isLoading}
        onRetry={() => { void transition("retry"); }} onNext={() => { void transition("next"); }} onOpenAi={handleOpenAi} />}
      {phase === "summary" && snapshot && <><SessionSummary session={snapshot}
        onGoToDashboard={() => router.push("/")} onNewSession={() => router.push("/practice")} />
        {snapshot.roadNodeId && <Button asChild className="w-full"><Link href="/learning-road">{roadText[locale].continue}</Link></Button>}
        <PracticeHistory sessionId={sessionId} /></>}
      <AiTutorPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} question={question}
        stepAnswers={stepAnswers} hasAttempted={phase === "result"} attemptId={snapshot?.result?.attemptId}
        sessionId={sessionId} onHintUsed={handleHintUsed} initialAction={aiAction} />
    </div>
  );
}

export default function PracticeSessionPage() {
  return <Suspense fallback={<div className="p-8 text-center text-muted-foreground">...</div>}><PracticeSessionContent /></Suspense>;
}
