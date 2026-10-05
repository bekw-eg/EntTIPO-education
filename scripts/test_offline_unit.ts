import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { activeAccount, setActiveAccount, savePackage, listPackages, saveDraft, getWork, enqueue, queueFor, deletePackage, updateWork } from "../lib/offline/store";
import { synchronize } from "../lib/offline/sync";
import { gradeLocal, simpleNumber } from "../lib/offline/grading";
import type { OfflinePackage, OfflineStep } from "../lib/offline/types";

async function main() {
  assert.equal(simpleNumber("1/2"), .5); assert.equal(simpleNumber("0,5"), .5);
  for (const value of ["sqrt(4)", "2^3", "Infinity", "1/0", "NaN", "(()=>42)()", "1e3", "1/2/3"]) assert.equal(simpleNumber(value), null);
  const number: OfflineStep = { id: "n", type: "numeric_input", prompt: "Number", options: [], localKey: { kind: "number", value: "0.5" } };
  assert.equal(gradeLocal(number, "1/2"), "correct"); assert.equal(gradeLocal(number, "1"), "incorrect");
  assert.equal(gradeLocal(number, "sqrt(0.25)"), "pending");
  assert.equal(gradeLocal({ ...number, localKey: undefined, type: "expression_input" }, "anything"), "pending");
  const choice: OfflineStep = { id: "c", type: "multiple_choice", prompt: "Choose", options: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }], localKey: { kind: "choice", value: "yes" } };
  assert.equal(gradeLocal(choice, "yes"), "correct"); assert.equal(gradeLocal(choice, "no"), "incorrect"); assert.equal(gradeLocal(choice, "forged"), "pending");
  const select = { ...choice, type: "multiple_select", localKey: { kind: "select" as const, value: '["yes"]' } };
  assert.equal(gradeLocal(select, '["yes"]'), "correct"); assert.equal(gradeLocal(select, '["no"]'), "incorrect");
  assert.equal(gradeLocal(select, '["yes","yes"]'), "pending");
  console.log("PASS: honest deterministic grading boundary; symbolic answers remain pending");
  const pack: OfflinePackage = { id: crypto.randomUUID(), userId: "A", sessionId: "session-A", format: 1, topicIds: ["topic"],
    language: "ru", title: "Private topic A", contentVersion: "a".repeat(64), downloadedAt: new Date().toISOString(), assetsVersion: "assets", bytes: 1, assetBytes: 1,
    assets: { version: "assets", files: [] }, rules: [], materials: [], questions: [0, 1].map(i => ({ id: `q${i}`, title: "Compute", text: "1/2", latex: "\\frac{1}{2}", steps: [{ ...number, id: `s${i}` }] })) };
  await setActiveAccount({ userId: "A", name: "A" }); await savePackage(pack);
  let work = (await getWork("A", pack.sessionId))!;
  work = await saveDraft("A", pack.sessionId, work.localRevision, "q0", { s0: "1/2" }, 0);
  await assert.rejects(saveDraft("A", pack.sessionId, 0, "q0", { s0: "overwrite" }, 0), /another tab/);
  assert.deepEqual((await getWork("A", pack.sessionId))?.answers, { q0: { s0: "1/2" } });
  const entry = await enqueue(pack, "q0", work.localRevision);
  assert.equal(entry.local.s0, "correct");
  work = (await getWork("A", pack.sessionId))!;
  const same = await enqueue(pack, "q0", work.localRevision); assert.equal(same.submissionId, entry.submissionId);
  await assert.rejects(deletePackage(pack), /Synchronize/);
  await setActiveAccount(null); await assert.rejects(listPackages("A"), /Account changed/);
  await setActiveAccount({ userId: "B", name: "B" }); assert.deepEqual(await listPackages("B"), []);
  await setActiveAccount(null, "A"); assert.equal((await activeAccount())?.userId, "B", "An old auth response cannot lock the new account");
  await assert.rejects(queueFor("A"), /Account changed/);
  await setActiveAccount({ userId: "A", name: "A" });
  assert.equal((await queueFor("A"))[0].submissionId, entry.submissionId);
  console.log("PASS: atomic drafts/queue, stable IDs, tab conflicts, protected deletion and account isolation");
  work = (await getWork("A", pack.sessionId))!;
  work = await saveDraft("A", pack.sessionId, work.localRevision, "q1", { s1: "sqrt(0.25)" }, 1);
  const second = await enqueue(pack, "q1", work.localRevision);
  const sentIds: string[] = [], attempts = new Map<string, object>();
  let loseResponse = true, mode = "online";
  const mock = async (url: string, init?: RequestInit) => {
    if (mode === "offline") throw new Error("connection lost");
    if (url === "/api/auth/me") return Response.json({ user: { id: mode === "wrong-account" ? "B" : "A" } }, { status: mode === "expired" ? 401 : 200 });
    const body = JSON.parse(init!.body as string); sentIds.push(body.submissionId);
    assert.equal(body.userId, "A"); assert.ok(!("local" in body));
    if (mode === "conflict" || mode === "stale") return Response.json({ code: mode === "stale" ? "STALE_PACKAGE" : "SESSION_CONFLICT" }, { status: 409 });
    const receipt = attempts.get(body.submissionId) ?? { submissionId: body.submissionId, revision: attempts.size + 1,
      result: { isCorrect: true, score: 100, stepResults: [] } };
    attempts.set(body.submissionId, receipt);
    if (loseResponse) { loseResponse = false; throw new Error("response lost after commit"); }
    return Response.json(receipt);
  };
  mode = "offline"; await synchronize("A", mock); assert.equal(sentIds.length, 0);
  mode = "online"; await synchronize("A", mock); assert.equal(attempts.size, 1);
  assert.ok((await queueFor("A")).every(q => !q.receipt));
  assert.equal((await queueFor("A"))[0].submissionId, entry.submissionId);
  mode = "expired"; await synchronize("A", mock); assert.equal((await getWork("A", pack.sessionId))?.blocked, "auth");
  assert.equal((await activeAccount())?.requiresLogin, true);
  mode = "conflict"; await synchronize("A", mock); assert.equal((await getWork("A", pack.sessionId))?.blocked, "conflict");
  await updateWork("A", pack.sessionId, { blocked: undefined });
  mode = "stale"; await synchronize("A", mock); assert.equal((await getWork("A", pack.sessionId))?.blocked, "stale");
  assert.deepEqual((await queueFor("A")).map(q => q.submissionId), [entry.submissionId, second.submissionId]);
  await updateWork("A", pack.sessionId, { blocked: undefined });
  mode = "online"; await Promise.all([synchronize("A", mock), synchronize("A", mock)]);
  assert.equal(attempts.size, 2); assert.ok((await queueFor("A")).every(q => q.receipt));
  assert.deepEqual(sentIds.slice(-2), [entry.submissionId, second.submissionId]);
  await synchronize("A", mock); assert.equal(attempts.size, 2);
  await deletePackage(pack); assert.deepEqual(await listPackages("A"), []);
  console.log("PASS: disconnected/expired/conflicting/stale queue survives; lost receipt replays once, ordered sync acknowledges atomically");
  mode = "wrong-account"; const before = sentIds.length; await synchronize("A", mock); assert.equal(await activeAccount(), null); assert.equal(sentIds.length, before);
  console.log("PASS: changed cookie cannot send another account's queue");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
