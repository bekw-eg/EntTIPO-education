import type { OfflineAccount, OfflinePackage, OfflineWork, QueueEntry, Answers } from "./types";
import { gradeLocal } from "./grading";

const DB_NAME = "enttipo-offline-v1";
const STORES = ["packages", "work", "queue", "meta"] as const;
type Store = typeof STORES[number];
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other tabs to update offline storage"));
  });
}
function read<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function all<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(names: Store[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Offline write aborted")); };
    action(tx).then(value => { result = value; }).catch(error => { tx.abort(); reject(error); });
  });
}
const key = (owner: string, id: string) => [owner, id];
export function activeAccount() { return transaction(["meta"], "readonly", tx => read<OfflineAccount | null>(tx.objectStore("meta"), "active")); }
export function offlineLocked() { return transaction(["meta"], "readonly", tx => read<boolean>(tx.objectStore("meta"), "locked")); }
export function setOfflineLock(locked: boolean) {
  return transaction(["meta"], "readwrite", async tx => { tx.objectStore("meta").put(locked, "locked"); });
}
export async function setActiveAccount(account: OfflineAccount | null, expectedUserId?: string) {
  const changed = await transaction(["meta"], "readwrite", async tx => {
    if (expectedUserId && (await read<OfflineAccount | null>(tx.objectStore("meta"), "active"))?.userId !== expectedUserId) return false;
    tx.objectStore("meta").put(account, "active"); tx.objectStore("meta").put(!account, "locked");
    return true;
  });
  if (!changed) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("enttipo_offline_account"));
    try { localStorage.setItem("enttipo_offline_account_changed", crypto.randomUUID()); } catch { /* optional notification */ }
  }
}
async function requireOwner(tx: IDBTransaction, userId: string) {
  const account = await read<OfflineAccount | null>(tx.objectStore("meta"), "active");
  if (!account || account.userId !== userId) throw new Error("Account changed; reopen offline practice");
}
export async function savePackage(pack: OfflinePackage) {
  await transaction(["meta", "packages", "work"], "readwrite", async tx => {
    await requireOwner(tx, pack.userId);
    tx.objectStore("packages").put(pack, key(pack.userId, pack.id));
    if (!await read(tx.objectStore("work"), key(pack.userId, pack.sessionId))) {
      const work: OfflineWork = { userId: pack.userId, sessionId: pack.sessionId, packageId: pack.id,
        currentIndex: 0, answers: {}, revision: 0, localRevision: 0 };
      tx.objectStore("work").put(work, key(pack.userId, pack.sessionId));
    }
  });
}
export function listPackages(userId: string) {
  return transaction(["meta", "packages"], "readonly", async tx => {
    await requireOwner(tx, userId);
    return (await all<OfflinePackage>(tx.objectStore("packages"))).filter(pack => pack.userId === userId)
      .sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
  });
}
export function getWork(userId: string, sessionId: string) {
  return transaction(["meta", "work"], "readonly", async tx => {
    await requireOwner(tx, userId); return read<OfflineWork>(tx.objectStore("work"), key(userId, sessionId));
  });
}
export function queueFor(userId: string, sessionId?: string) {
  return transaction(["meta", "queue"], "readonly", async tx => {
    await requireOwner(tx, userId);
    return (await all<QueueEntry>(tx.objectStore("queue"))).filter(entry => entry.userId === userId && (!sessionId || entry.sessionId === sessionId))
      .sort((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence);
  });
}
export function updateWork(userId: string, sessionId: string, patch: Partial<Pick<OfflineWork, "revision" | "acceptedVersion" | "reconcile" | "blocked" | "message">>) {
  return transaction(["meta", "work"], "readwrite", async tx => {
    await requireOwner(tx, userId);
    const work = await read<OfflineWork>(tx.objectStore("work"), key(userId, sessionId));
    if (!work) throw new Error("Missing offline training");
    tx.objectStore("work").put({ ...work, ...patch }, key(userId, sessionId));
  });
}
/** Compare-and-swap protects two tabs from replacing each other's unsent draft. */
export function saveDraft(userId: string, sessionId: string, localRevision: number, questionId: string, answers: Answers, currentIndex: number) {
  return transaction(["meta", "work"], "readwrite", async tx => {
    await requireOwner(tx, userId);
    const work = await read<OfflineWork>(tx.objectStore("work"), key(userId, sessionId));
    if (!work || work.localRevision !== localRevision) throw new Error("Draft changed in another tab; reopen the training");
    const saved = { ...work, answers: { ...work.answers, [questionId]: answers }, currentIndex, localRevision: localRevision + 1 };
    tx.objectStore("work").put(saved, key(userId, sessionId));
    return saved;
  });
}
/** Answer, stable ID, cursor and queue commit atomically before any network request. */
export function enqueue(pack: OfflinePackage, questionId: string, localRevision: number) {
  return transaction(["meta", "work", "queue"], "readwrite", async tx => {
    await requireOwner(tx, pack.userId);
    const work = await read<OfflineWork>(tx.objectStore("work"), key(pack.userId, pack.sessionId));
    if (!work || work.localRevision !== localRevision) throw new Error("Draft changed in another tab; reopen the training");
    const existing = (await all<QueueEntry>(tx.objectStore("queue"))).find(e => e.userId === pack.userId && e.sessionId === pack.sessionId && e.questionId === questionId);
    if (existing) return existing;
    const sequence = pack.questions.findIndex(q => q.id === questionId);
    const question = pack.questions[sequence];
    if (!question || sequence !== (await all<QueueEntry>(tx.objectStore("queue"))).filter(e => e.userId === pack.userId && e.sessionId === pack.sessionId).length) {
      throw new Error("Submit the questions in their original order");
    }
    const answers = work.answers[questionId] ?? {};
    if (question.steps.some(step => !answers[step.id]?.trim() || answers[step.id].length > 2000)) throw new Error("Answer every step (up to 2000 characters)");
    const entry: QueueEntry = {
      submissionId: crypto.randomUUID(), userId: pack.userId, sessionId: pack.sessionId, packageId: pack.id,
      questionId, sequence, contentVersion: pack.contentVersion, usedHint: true, timeSpent: 0, createdAt: Date.now(),
      stepAnswers: question.steps.map(step => ({ stepId: step.id, answer: answers[step.id].trim() })),
      local: Object.fromEntries(question.steps.map(step => [step.id, gradeLocal(step, answers[step.id])])),
    };
    tx.objectStore("queue").put(entry, key(pack.userId, entry.submissionId));
    tx.objectStore("work").put({ ...work, localRevision: localRevision + 1 }, key(pack.userId, pack.sessionId));
    return entry;
  });
}
export function acknowledge(entry: QueueEntry, receipt: NonNullable<QueueEntry["receipt"]>) {
  return transaction(["meta", "work", "queue"], "readwrite", async tx => {
    await requireOwner(tx, entry.userId);
    if (receipt.submissionId !== entry.submissionId || !Number.isInteger(receipt.revision)) throw new Error("Invalid server receipt");
    const saved = await read<QueueEntry>(tx.objectStore("queue"), key(entry.userId, entry.submissionId));
    if (!saved) throw new Error("Missing pending answer");
    const work = await read<OfflineWork>(tx.objectStore("work"), key(entry.userId, entry.sessionId));
    if (!work) throw new Error("Missing training");
    tx.objectStore("queue").put({ ...saved, receipt }, key(entry.userId, entry.submissionId));
    tx.objectStore("work").put({ ...work, revision: Math.max(work.revision, receipt.revision), blocked: undefined, message: undefined }, key(entry.userId, entry.sessionId));
  });
}
export function deletePackage(pack: OfflinePackage) {
  return transaction(["meta", "packages", "queue", "work"], "readwrite", async tx => {
    await requireOwner(tx, pack.userId);
    const queue = (await all<QueueEntry>(tx.objectStore("queue"))).filter(e => e.userId === pack.userId && e.packageId === pack.id);
    const work = await read<OfflineWork>(tx.objectStore("work"), key(pack.userId, pack.sessionId));
    if (queue.some(e => !e.receipt) || Object.entries(work?.answers ?? {}).some(([qid, answers]) => Object.values(answers).some(Boolean) && !queue.some(e => e.questionId === qid && e.receipt))) {
      throw new Error("Synchronize or export your unfinished answers before deleting this package");
    }
    tx.objectStore("packages").delete(key(pack.userId, pack.id));
    tx.objectStore("work").delete(key(pack.userId, pack.sessionId));
    queue.forEach(e => tx.objectStore("queue").delete(key(pack.userId, e.submissionId)));
  });
}
