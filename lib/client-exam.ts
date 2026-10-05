import { saveExamSchema } from "./exam/mode";
import { z } from "zod";
export type PendingExamSave = z.infer<typeof saveExamSchema>;
const key = (userId: string, examId: string) => `enttipo_exam_pending_v1:${userId}:${examId}`;
export function backupExamSave(userId: string, examId: string, pending: PendingExamSave | null) {
  try {
    if (pending) localStorage.setItem(key(userId, examId), JSON.stringify(pending));
    else localStorage.removeItem(key(userId, examId));
    return true;
  } catch { return false; }
}
export function recoverExamSave(userId: string, examId: string): PendingExamSave | null {
  try {
    const raw = localStorage.getItem(key(userId, examId));
    if (!raw) return null;
    const value = saveExamSchema.safeParse(JSON.parse(raw));
    return value.success ? value.data : null;
  } catch { return null; }
}
// A monotonic display clock. The server independently enforces the persisted deadline.
export function examDisplaySeconds(remaining: number, receivedAt: number, monotonicNow: number) {
  return Math.max(0, remaining - Math.floor(Math.max(0, monotonicNow - receivedAt) / 1000));
}
