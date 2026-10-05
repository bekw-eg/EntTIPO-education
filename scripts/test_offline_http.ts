import assert from "node:assert/strict";
import crypto from "node:crypto";
import { api, fixture, prisma } from "./offline_test_fixture";

async function main() {
  const f = await fixture();
  try {
    assert.equal((await api("/api/offline/packages", "", "POST", {})).status, 401);
    const settings = { downloadId: crypto.randomUUID(), topicIds: [f.topic.id], language: "ru", count: 3 };
    const downloaded = await api("/api/offline/packages", f.a.cookie, "POST", settings); assert.equal(downloaded.status, 200);
    const pack = downloaded.data;
    assert.equal(pack.userId, f.a.id); assert.equal(pack.questions.length, 3); assert.equal(pack.rules.length, 1); assert.equal(pack.materials.length, 1);
    assert.ok(pack.assets.files.length > 50); assert.ok(pack.questions.every((q: any) => !q.steps[1].localKey));
    assert.deepEqual((await api("/api/offline/packages", f.a.cookie, "POST", settings)).data, pack);
    assert.equal((await api("/api/offline/packages", f.a.cookie, "POST", { ...settings, count: 2 })).status, 409);
    assert.equal((await api(`/api/offline/packages/${pack.id}`, f.b.cookie)).status, 404);
    assert.equal((await api("/api/offline/packages", f.b.cookie, "POST", settings)).status, 404);
    const kk = await api("/api/offline/packages", f.a.cookie, "POST", { ...settings, downloadId: crypto.randomUUID(), language: "kk", count: 1 });
    assert.equal(kk.status, 200); assert.equal(kk.data.language, "kk");
    assert.equal(kk.data.materials[0].title, "Желісіз материалдар"); assert.equal(kk.data.questions[0].steps[0].prompt, "Сандық нәтиже");
    const normal = (await api("/api/sessions", f.a.cookie, "POST", { mode: "specific_topic", topicId: f.topic.id, totalCount: 1 })).data;
    const publicQ = (await api(`/api/sessions/${normal.id}`, f.a.cookie)).data.question;
    assert.ok(publicQ.steps.every((s: any) => !("expectedAnswer" in s) && s.options.every((o: any) => !("isCorrect" in o))));
    console.log("PASS: explicit complete package, deterministic retry, owner checks; normal tasks still hide keys");
    function payload(index: number, correct = true) {
      const q = pack.questions[index];
      return { userId: f.a.id, packageId: pack.id, sessionId: pack.sessionId, contentVersion: pack.contentVersion,
        sequence: index, revision: index, submissionId: crypto.randomUUID(), usedHint: false, timeSpent: 4,
        // Tampered preliminary grade must never be accepted as authoritative.
        localResult: { isCorrect: true, score: 100 },
        questionId: q.id, stepAnswers: q.steps.map((s: any, i: number) => ({ stepId: s.id,
          answer: i === 0 ? correct ? "1/2" : "2" : i === 1 ? "x+x" : s.localKey.value })) };
    }
    const first = payload(0, false);
    assert.equal((await api("/api/offline/sync", f.b.cookie, "POST", first)).status, 403);
    assert.equal((await api("/api/offline/sync", "", "POST", first)).status, 401);
    assert.equal((await api("/api/attempts", f.a.cookie, "POST", first)).status, 409);
    assert.equal((await api("/api/offline/sync", f.a.cookie, "POST", payload(1))).status, 409);
    const copies = await Promise.all([api("/api/offline/sync", f.a.cookie, "POST", first), api("/api/offline/sync", f.a.cookie, "POST", first)]);
    assert.equal(copies[0].status, 200); assert.deepEqual(copies[0].data, copies[1].data);
    assert.equal(copies[0].data.result.isCorrect, false); assert.equal(copies[0].data.result.usedHint, true);
    assert.equal(await prisma.userAttempt.count({ where: { userId: f.a.id } }), 1);
    assert.equal(await prisma.userTopicProgress.count({ where: { userId: f.a.id } }), 1);
    assert.equal((await api("/api/offline/sync", f.a.cookie, "POST", { ...first, stepAnswers: first.stepAnswers.map((s: any) => ({ ...s, answer: "999" })) })).status, 409);
    console.log("PASS: ordered queue, server regrading ignores forged local score, concurrent/lost-response replay updates progress exactly once");
    const second = payload(1);
    await prisma.practiceSession.update({ where: { id: pack.sessionId }, data: { revision: { increment: 1 } } });
    assert.equal((await api("/api/offline/sync", f.a.cookie, "POST", second)).data.code, "SESSION_CONFLICT");
    const current = (await api(`/api/offline/packages/${pack.id}`, f.a.cookie)).data;
    const reconciled = await api("/api/offline/sync", f.a.cookie, "POST", { ...second, revision: current.revision, reconcile: true });
    assert.equal(reconciled.status, 200); assert.equal(reconciled.data.result.isCorrect, true);
    const third = payload(2);
    await prisma.questionStep.update({ where: { id: third.stepAnswers[0].stepId }, data: { expectedAnswer: "0.75" } });
    const stale = await api("/api/offline/sync", f.a.cookie, "POST", { ...third, revision: reconciled.data.revision });
    assert.equal(stale.status, 409); assert.equal(stale.data.code, "STALE_PACKAGE");
    const updated = (await api(`/api/offline/packages/${pack.id}`, f.a.cookie)).data;
    const accepted = { ...third, revision: updated.revision, acceptedVersion: updated.currentVersion };
    const checked = await api("/api/offline/sync", f.a.cookie, "POST", accepted);
    assert.equal(checked.status, 200); assert.equal(checked.data.result.isCorrect, false); assert.equal(checked.data.result.stepResults[0].expectedAnswer, "0.75");
    assert.equal((await prisma.practiceSession.findUniqueOrThrow({ where: { id: pack.sessionId } })).status, "completed");
    assert.deepEqual((await api("/api/offline/sync", f.a.cookie, "POST", accepted)).data, checked.data);
    assert.equal(await prisma.userAttempt.count({ where: { userId: f.a.id } }), 3);
    assert.equal(await prisma.learningCheck.count({ where: { userId: f.a.id, status: "passed" } }), 0);
    const pending = { ...payload(0), packageId: kk.data.id, sessionId: kk.data.sessionId, contentVersion: kk.data.contentVersion, revision: 0 };
    await prisma.questionStep.update({ where: { id: pending.stepAnswers[0].stepId }, data: { type: "expression_input" } });
    const structure = (await api(`/api/offline/packages/${kk.data.id}`, f.a.cookie)).data;
    assert.equal((await api("/api/offline/sync", f.a.cookie, "POST", { ...pending, acceptedVersion: structure.currentVersion })).data.code, "PACKAGE_STRUCTURE_CHANGED");
    assert.equal(await prisma.userAttempt.count({ where: { userId: f.a.id } }), 3, "Changed step structure cannot silently reinterpret an old answer");
    console.log("PASS: conflict/stale version preserve stable answer IDs; explicit acceptance regrades current server key; assisted offline work cannot confirm an independent check");
  } finally { await f.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
