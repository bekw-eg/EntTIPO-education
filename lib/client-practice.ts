import { z } from "zod";
import type { PracticeSnapshot } from "@/types";

const answersSchema = z.record(z.string().max(2000)).refine((answers) => Object.keys(answers).length <= 50);
const backupSchema = z.object({
  version: z.literal(1), userId: z.string(), sessionId: z.string(), questionId: z.string(),
  currentIndex: z.number().int().nonnegative(), revision: z.number().int().nonnegative(),
  answers: answersSchema, sentAnswers: z.array(answersSchema).max(10).optional(), startedAt: z.number().finite().nonnegative(),
  pendingSubmission: z.object({
    submissionId: z.string().uuid(), sessionId: z.string(), questionId: z.string(),
    stepAnswers: z.array(z.object({ stepId: z.string(), answer: z.string().max(2000) })).max(50),
    timeSpent: z.number().int().nonnegative(), usedHint: z.boolean(),
  }).nullable(),
});

export type PracticeDraft = z.infer<typeof backupSchema>;
export type PracticeSubmission = NonNullable<PracticeDraft["pendingSubmission"]>;

export function sameAnswers(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function practiceDraftKey(userId: string, sessionId: string) {
  return `enttipo_practice_v1:${userId}:${sessionId}`;
}

export function writePracticeDraft(draft: PracticeDraft): boolean {
  try {
    localStorage.setItem(practiceDraftKey(draft.userId, draft.sessionId), JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export function clearPracticeDraft(userId: string, sessionId: string) {
  try { localStorage.removeItem(practiceDraftKey(userId, sessionId)); } catch { /* Storage may be blocked. */ }
}

export function readPracticeDraft(userId: string, snapshot: PracticeSnapshot): PracticeDraft | null {
  try {
    const raw = localStorage.getItem(practiceDraftKey(userId, snapshot.id));
    if (!raw) return null;
    const parsed = backupSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const draft = parsed.data;
    if (draft.userId !== userId || draft.sessionId !== snapshot.id || snapshot.status !== "active" || snapshot.result ||
      draft.questionId !== snapshot.question?.id || draft.currentIndex !== snapshot.currentIndex) return null;
    // Recover a lost autosave response only if the server contains that exact write.
    if (draft.revision !== snapshot.revision && !(snapshot.revision === draft.revision + 1 &&
      draft.sentAnswers?.some((sent) => sameAnswers(sent, snapshot.draftAnswers)))) return null;
    const steps = new Set(snapshot.question.steps.map((step) => step.id));
    if (Object.keys(draft.answers).some((id) => !steps.has(id))) return null;
    const pending = draft.pendingSubmission;
    if (pending && (pending.sessionId !== snapshot.id || pending.questionId !== draft.questionId ||
      pending.stepAnswers.length !== steps.size || new Set(pending.stepAnswers.map((step) => step.stepId)).size !== steps.size ||
      pending.stepAnswers.some((step) => !steps.has(step.stepId) || draft.answers[step.stepId]?.trim() !== step.answer.trim()))) return null;
    const { sentAnswers: _sentAnswers, ...recovered } = draft;
    return { ...recovered, revision: snapshot.revision,
      ...(draft.revision === snapshot.revision && draft.sentAnswers ? { sentAnswers: draft.sentAnswers } : {}),
    };
  } catch { return null; }
}
