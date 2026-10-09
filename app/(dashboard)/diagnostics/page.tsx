"use client";
import Link from "@/components/layout/PublicLink";
import { preparationText } from "@/lib/i18n/preparation";
import { Header } from "@/components/layout/Header";
import { PageLoading } from "@/components/ui/page-state";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import QuestionCard from "@/components/practice/QuestionCard";
import { DiagnosticResults, SkillProgressCards } from "@/components/diagnostics/SkillResults";
import { useAccount } from "@/components/providers/AccountProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { diagnosticText } from "@/lib/i18n/diagnostics";
import { learningText } from "@/lib/i18n/learning";
import { createSubmissionId } from "@/lib/client-submission";
import { PracticeDraft, clearPracticeDraft, readPracticeDraft, sameAnswers, writePracticeDraft } from "@/lib/client-practice";
import type { PracticeSnapshot } from "@/types";
import type { DiagnosticSnapshot, SkillProgressView } from "@/types/diagnostics";

// Share the proven account-scoped recovery format from stage 3, including pending UUIDs.
function recoverySnapshot(data: DiagnosticSnapshot): PracticeSnapshot {
  return { ...data, result: null, correctCount: 0, attemptCount: data.completedCount, correctAttemptCount: 0, mode: "diagnostic" };
}

export default function DiagnosticsPage() {
  const { user } = useAccount();
  const { locale } = useLanguage();
  const copy = diagnosticText[locale];
  const prep = preparationText[locale];
  const router = useRouter();
  const userId = user?.id;
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null);
  const [skills, setSkills] = useState<SkillProgressView[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "local">("saved");
  const draftRef = useRef<PracticeDraft | null>(null);
  const stateRef = useRef<DiagnosticSnapshot | null>(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const savingRef = useRef<Promise<void> | null>(null);
  const aliveRef = useRef(true);
  const backedUpRef = useRef(true);

  const backup = () => { if (draftRef.current) backedUpRef.current = writePracticeDraft(draftRef.current); };
  const apply = (data: DiagnosticSnapshot, recover = false) => {
    if (!aliveRef.current || !userId) return;
    const local = recover ? readPracticeDraft(userId, recoverySnapshot(data)) : null;
    stateRef.current = data;
    const restored = local?.answers ?? data.draftAnswers;
    dirtyRef.current = !!local && !sameAnswers(restored, data.draftAnswers);
    draftRef.current = data.status === "active" && data.question ? local ?? {
      version: 1, userId, sessionId: data.id, questionId: data.question.id,
      currentIndex: data.currentIndex, revision: data.revision, answers: restored,
      startedAt: Date.now(), pendingSubmission: null,
    } : null;
    if (draftRef.current) backup(); else clearPracticeDraft(userId, data.id);
    setSnapshot(data); setAnswers(restored); setPending(!!draftRef.current?.pendingSubmission);
    setSaveStatus(dirtyRef.current ? "local" : "saved"); setError(false);
  };
  const read = async (id: string, recover = true) => {
    const res = await fetch(`/api/diagnostics/${id}`, { cache: "no-store" });
    if (res.status === 401) router.replace("/login");
    if (!res.ok) throw new Error(copy.error);
    apply(await res.json(), recover);
  };
  const readSkills = async () => {
    const res = await fetch("/api/skills", { cache: "no-store" });
    if (!res.ok) throw new Error(copy.error);
    if (aliveRef.current) setSkills(await res.json());
  };
  const load = async () => {
    setLoading(true);
    try {
      await readSkills();
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error(copy.error);
      const sessions = await res.json();
      if (sessions[0]) await read(sessions[0].id);
      if (aliveRef.current) setError(false);
    } catch { if (aliveRef.current) setError(true); }
    finally { if (aliveRef.current) setLoading(false); }
  };
  const flush = (): Promise<void> => {
    if (savingRef.current) return savingRef.current;
    const save = async () => {
      try {
        while (dirtyRef.current && draftRef.current) {
          const draft = draftRef.current;
          const sent = { ...draft.answers };
          draft.sentAnswers = [...(draft.sentAnswers ?? []), sent].slice(-10); backup();
          if (aliveRef.current) setSaveStatus("saving");
          const res = await fetch(`/api/diagnostics/${draft.sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revision: draft.revision, currentIndex: draft.currentIndex, answers: sent }) });
          if (res.status === 409) { await read(draft.sessionId); continue; }
          if (!res.ok) throw new Error(copy.error);
          const saved = await res.json();
          if (!aliveRef.current) return;
          draft.revision = saved.revision; draft.sentAnswers = undefined;
          if (stateRef.current) stateRef.current.revision = saved.revision;
          dirtyRef.current = !sameAnswers(draft.answers, sent); backup();
        }
        if (aliveRef.current) setSaveStatus("saved");
      } catch (e) { if (aliveRef.current) setSaveStatus("local"); throw e; }
    };
    savingRef.current = save().finally(() => { savingRef.current = null; });
    return savingRef.current;
  };
  useEffect(() => {
    aliveRef.current = true;
    if (userId) void load();
    const exit = () => {
      backup();
      const draft = draftRef.current;
      if (dirtyRef.current && draft && !savingRef.current) {
        draft.sentAnswers = [...(draft.sentAnswers ?? []), { ...draft.answers }].slice(-10); backup();
        void fetch(`/api/diagnostics/${draft.sessionId}`, { method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: draft.revision, currentIndex: draft.currentIndex, answers: draft.answers }) }).catch(() => {});
      }
    };
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !backedUpRef.current) { event.preventDefault(); event.returnValue = ""; } };
    const online = () => { if (dirtyRef.current) void flush().catch(() => {}); };
    window.addEventListener("pagehide", exit); window.addEventListener("beforeunload", warn); window.addEventListener("online", online);
    return () => { aliveRef.current = false; window.removeEventListener("pagehide", exit); window.removeEventListener("beforeunload", warn); window.removeEventListener("online", online); };
  }, [userId]);
  useEffect(() => {
    if (!dirtyRef.current || busyRef.current) return;
    const timer = setTimeout(() => { void flush().catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [answers]);
  const edit = (stepId: string, answer: string) => {
    const draft = draftRef.current;
    if (!draft || busyRef.current || draft.pendingSubmission) return;
    draft.answers = { ...draft.answers, [stepId]: answer }; dirtyRef.current = true; backup();
    setAnswers(draft.answers); setSaveStatus("saving");
  };
  const start = async (restartFromId?: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const res = await fetch("/api/diagnostics", { method: "POST", ...(restartFromId ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restartFromId }) } : {}) });
      if (!res.ok) throw new Error(copy.error);
      apply(await res.json(), true);
    } catch { toast.error(copy.error); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (busyRef.current || !draftRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const intended = draftRef.current;
      await flush();
      const draft = draftRef.current;
      if (!draft || draft !== intended) return;
      draft.pendingSubmission ??= { submissionId: createSubmissionId(), sessionId: draft.sessionId, questionId: draft.questionId,
        stepAnswers: Object.entries(draft.answers).map(([stepId, answer]) => ({ stepId, answer })), timeSpent: 0, usedHint: false };
      backup(); setPending(true);
      const res = await fetch(`/api/diagnostics/${draft.sessionId}/answers`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: draft.pendingSubmission.submissionId, questionId: draft.questionId,
          stepAnswers: draft.pendingSubmission.stepAnswers, revision: draft.revision }) });
      if (!res.ok) {
        if (res.status === 400) { draft.pendingSubmission = null; backup(); setPending(false); }
        if (res.status === 409) await read(draft.sessionId);
        throw new Error(copy.error);
      }
      await read(draft.sessionId, false);
      if (stateRef.current?.status === "completed") await readSkills();
    } catch { toast.error(copy.error); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <><Header title={copy.title} /><div className="page-content reading-content">
    {loading ? <PageLoading /> : error ? <div role="alert" className="space-y-3"><p>{copy.error}</p><Button onClick={() => { void load(); }}>{copy.reload}</Button></div> : <>
      {!snapshot && <div className="space-y-4"><p className="text-muted-foreground">{copy.intro}</p><Button disabled={busy} onClick={() => { void start(); }}>{copy.start}</Button></div>}
      {snapshot?.status === "active" && snapshot.question && <>
        <p role="status" className="text-xs text-right">{copy[saveStatus]}</p>
        {pending && !busy && <p role="alert" className="text-sm text-amber-600">{copy.pending}</p>}
        <QuestionCard question={snapshot.question} stepAnswers={answers} onStepAnswer={edit} onSubmit={() => { void submit(); }}
          currentIndex={snapshot.currentIndex} totalCount={snapshot.totalCount} isLoading={busy} answersLocked={pending}
          assistanceDisabled startedAt={draftRef.current?.startedAt}
          submitLabel={snapshot.currentIndex + 1 === snapshot.totalCount ? copy.finish : copy.next} />
      </>}
      {snapshot?.result && <section className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">{prep.stages.road_ready}</h2>
        <p>{copy.checked}: {snapshot.result.correctCount} / {snapshot.result.totalCount}</p>
        <p className="text-sm text-muted-foreground">{prep.unknown}</p>
        <p className="text-sm"><strong>{prep.strengths}: </strong>{snapshot.result.skills.filter(s => s.evidence.length >= 3 && s.evidence.every(e => e.isCorrect)).map(s => locale === "kk" ? s.nameKk : s.nameRu).join(" · ") || copy.insufficient}</p>
        <p className="text-sm"><strong>{prep.priorities}: </strong>{snapshot.result.skills.filter(s => s.evidence.some(e => !e.isCorrect)).map(s => locale === "kk" ? s.nameKk : s.nameRu).join(" · ") || copy.insufficient}</p>
        <Button asChild><Link href="/learning-road">{prep.start}</Link></Button>
      </section>}
      {snapshot?.result && <DiagnosticResults report={snapshot.result} />}
      {snapshot?.status === "completed" && <div className="space-y-2">
        <Button variant="outline" disabled={busy} onClick={() => { void start(snapshot.id); }}>{learningText[locale === "kk" ? "kk" : "ru"].retake}</Button>
        <p className="text-sm text-muted-foreground">{learningText[locale === "kk" ? "kk" : "ru"].retakeNote}</p>
      </div>}
      {snapshot?.status !== "active" && <SkillProgressCards skills={skills} />}
    </>}
  </div></>;
}
