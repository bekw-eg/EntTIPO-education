import { activeAccount, acknowledge, queueFor, getWork, updateWork, setActiveAccount } from "./store";
import type { OfflineSend, QueueEntry } from "./types";

export const request = (path: string, init?: RequestInit) => fetch(path, { ...init, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(20000) });
let running: Promise<void> | null = null;

/** Only the foreground account's queue is considered; the server also verifies the owner on every POST. */
export function synchronize(userId: string, fetcher: typeof request = request): Promise<void> {
  if (running) return running;
  running = sync(userId, fetcher).finally(() => { running = null; });
  return running;
}
async function sync(userId: string, fetcher: typeof request) {
  if ((await activeAccount())?.userId !== userId) return;
  let me: Response;
  try { me = await fetcher("/api/auth/me"); } catch { return; }
  if (me.status === 401) {
    const owner = await activeAccount();
    if (owner?.userId === userId) await setActiveAccount({ ...owner, requiresLogin: true }, userId);
    for (const entry of (await queueFor(userId)).filter(e => !e.receipt)) await updateWork(userId, entry.sessionId, { blocked: "auth" });
    return;
  }
  if (!me.ok) return;
  const identity = await me.json();
  if (identity.user?.id !== userId) {
    // Clear the visible scope immediately, retaining the original account's work.
    await setActiveAccount(null, userId);
    return;
  }
  const authorizedOwner = await activeAccount();
  if (authorizedOwner?.userId === userId && authorizedOwner.requiresLogin) await setActiveAccount({ ...authorizedOwner, requiresLogin: false }, userId);
  const stopped = new Set<string>();
  const entries = (await queueFor(userId)).filter(e => !e.receipt);
  for (const entry of entries) {
    if (stopped.has(entry.sessionId) || (await activeAccount())?.userId !== userId) continue;
    const work = await getWork(userId, entry.sessionId);
    if (!work || (work.blocked && work.blocked !== "auth" && work.blocked !== "error")) continue;
    const { local: _local, createdAt: _createdAt, receipt: _receipt, ...submission } = entry;
    const body: OfflineSend & { revision: number; acceptedVersion?: string; reconcile?: boolean } = {
      ...submission, revision: work.revision, acceptedVersion: work.acceptedVersion, reconcile: work.reconcile,
    };
    try {
      const response = await fetcher("/api/offline/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.status === 401 || (response.status === 403 && data.code === "REAUTH_REQUIRED")) {
        await updateWork(userId, entry.sessionId, { blocked: "auth" });
        const account = await activeAccount();
        if (account?.userId === userId) await setActiveAccount({ ...account, requiresLogin: true }, userId);
        return;
      }
      if (response.ok) {
        await acknowledge(entry, data as NonNullable<QueueEntry["receipt"]>);
      } else if (response.status === 403) {
        await updateWork(userId, entry.sessionId, { blocked: "error", message: data.error });
        stopped.add(entry.sessionId);
      } else if (response.status === 409 || response.status === 404 || response.status === 400) {
        await updateWork(userId, entry.sessionId, { blocked: ["STALE_PACKAGE", "PACKAGE_CONTENT_UNAVAILABLE", "PACKAGE_TRANSLATION_UNAVAILABLE", "PACKAGE_STRUCTURE_CHANGED"].includes(data.code) ? "stale" : "conflict", message: data.error });
        stopped.add(entry.sessionId);
      } else {
        // Retriable outage. The immutable entry survives, including a lost receipt.
        return;
      }
    } catch { return; }
  }
}
