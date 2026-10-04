import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { clearPracticeDraft, practiceDraftKey, readPracticeDraft, sameAnswers, writePracticeDraft, PracticeDraft } from "../lib/client-practice";
import { practiceStateSchema } from "../lib/validators";
import type { PracticeSnapshot } from "../types";

const storage = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const snapshot = { id: "session-a", status: "active", currentIndex: 1, revision: 4,
  draftAnswers: {}, result: null, question: { id: "q2", steps: [{ id: "s1" }, { id: "s2" }] },
} as unknown as PracticeSnapshot;
const draft: PracticeDraft = { version: 1, userId: "a", sessionId: "session-a", questionId: "q2",
  currentIndex: 1, revision: 4, answers: { s1: "unfinished (", s2: "" }, startedAt: 123, pendingSubmission: null };
assert.equal(writePracticeDraft(draft), true);
assert.deepEqual(readPracticeDraft("a", snapshot), draft);
assert.equal(readPracticeDraft("b", snapshot), null, "Backups belong to an account");
assert.equal(readPracticeDraft("a", { ...snapshot, id: "another-session" }), null);
assert.equal(readPracticeDraft("a", { ...snapshot, currentIndex: 2 }), null);
assert.equal(readPracticeDraft("a", { ...snapshot, revision: 5 }), null, "A newer server draft wins");
assert.equal(readPracticeDraft("a", { ...snapshot, status: "completed" }), null);
assert.equal(readPracticeDraft("a", { ...snapshot, result: {} as PracticeSnapshot["result"] }), null);

const sent = { s1: "first edit" };
writePracticeDraft({ ...draft, sentAnswers: [sent] });
assert.deepEqual(readPracticeDraft("a", { ...snapshot, revision: 5, draftAnswers: sent })?.answers, draft.answers,
  "Typing during a save survives a lost acknowledgement");
assert.equal(readPracticeDraft("a", { ...snapshot, revision: 5, draftAnswers: { s1: "other tab" } }), null);
assert.equal(readPracticeDraft("a", { ...snapshot, revision: 6, draftAnswers: sent }), null,
  "Matching text cannot revive a draft after unrelated newer revisions");
const reopened = readPracticeDraft("a", snapshot)!;
assert.deepEqual(reopened.sentAnswers, [sent], "Reopening before an old write arrives must retain its recovery record");
writePracticeDraft({ ...reopened, answers: { s1: "new typing" }, sentAnswers: [...reopened.sentAnswers!, { s1: "new typing" }] });
assert.deepEqual(readPracticeDraft("a", { ...snapshot, revision: 5, draftAnswers: sent })?.answers, { s1: "new typing" },
  "A delayed save from the closed page must not discard typing on the reopened page");

const pending = { submissionId: randomUUID(), sessionId: draft.sessionId, questionId: draft.questionId,
  stepAnswers: [{ stepId: "s1", answer: "2" }, { stepId: "s2", answer: "4" }], timeSpent: 17, usedHint: true };
writePracticeDraft({ ...draft, answers: { s1: "2", s2: "4" }, pendingSubmission: pending });
assert.deepEqual(readPracticeDraft("a", snapshot)?.pendingSubmission, pending, "The whole submission survives reload unchanged");
writePracticeDraft({ ...draft, pendingSubmission: pending });
assert.equal(readPracticeDraft("a", snapshot), null, "A corrupted pending payload cannot replace current answers");
writePracticeDraft({ ...draft, answers: { foreign: "2" } });
assert.equal(readPracticeDraft("a", snapshot), null);
storage.set(practiceDraftKey("a", snapshot.id), "not-json");
assert.equal(readPracticeDraft("a", snapshot), null);
writePracticeDraft(draft);
clearPracticeDraft("b", snapshot.id);
assert.ok(readPracticeDraft("a", snapshot));
clearPracticeDraft("a", snapshot.id);
assert.equal(readPracticeDraft("a", snapshot), null);
assert.equal(sameAnswers({ b: "", a: "2" }, { a: "2", b: "" }), true);
assert.equal(sameAnswers({ a: "2" }, { a: "2", b: "" }), false);
Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage disabled"); } });
assert.equal(writePracticeDraft(draft), false);
assert.equal(readPracticeDraft("a", snapshot), null);
assert.doesNotThrow(() => clearPracticeDraft("a", snapshot.id));
assert.equal(practiceStateSchema.safeParse({ action: "save", currentIndex: 0, revision: 0, answers: { s1: "", s2: "x^(" } }).success, true);
for (const data of [{ action: "save", revision: 0, answers: {} }, { action: "next", revision: -1 },
  { action: "save", revision: 0, currentIndex: 0, answers: { s1: "x".repeat(2001) } }]) {
  assert.equal(practiceStateSchema.safeParse(data).success, false);
}
console.log("PASS: immediate draft recovery, account/session isolation, stale versions, lost save responses and stable submission replay");
