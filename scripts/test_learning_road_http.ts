import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { api, prisma, noKeys, submission } from "./choice_test_fixture";
import { roadFixture, road, startNode, completeSession } from "./road_test_fixture";

async function main() {
  assert.equal((await api("/api/learning-road")).status, 401);
  const fixture = await roadFixture(), { a, b, skill } = fixture;
  try {
    const initialMastery = await prisma.userSkillProgress.findMany({ where: { userId: a.id } });
    const starts = await Promise.all([road(a.cookie), road(a.cookie), road(a.cookie)]);
    starts.forEach(value => assert.deepEqual(value, starts[0]));
    const first = starts[0]; noKeys(first);
    assert.ok(first.nodes.length >= 5 && first.nodes.length <= 8);
    assert.equal(first.nodes[0].skillId, skill.id);
    assert.ok(first.nodes.some(node => node.type === "REVIEW" && node.skillId === skill.id));
    assert.equal(first.nodes.filter(node => node.status === "CURRENT").length, 1);
    assert.deepEqual(await prisma.userSkillProgress.findMany({ where: { userId: a.id } }), initialMastery);
    assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "next_block" })).status, 409);
    const theory = first.nodes[0];
    assert.equal((await api("/api/learning-road", b.cookie, "POST", { action: "start", nodeId: theory.id })).status, 404);
    assert.equal((await api("/api/learning-road", b.cookie, "POST", { action: "complete_theory", nodeId: theory.id })).status, 404);
    assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "start", nodeId: theory.id, userId: b.id })).status, 400);
    const repair = first.nodes.find(node => node.type === "REPAIR")!;
    assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "complete_theory", nodeId: repair.id })).status, 400);
    // Out-of-order lessons are accessible, not locked by prerequisites or CURRENT.
    const concurrent = await Promise.all([startNode(a.cookie, repair.id), startNode(a.cookie, repair.id)]);
    assert.equal(concurrent[0].href, concurrent[1].href);
    const sessionId = concurrent[0].href.split("/").at(-1)!;
    let snapshot = (await api(`/api/sessions/${sessionId}`, a.cookie)).data; noKeys(snapshot);
    assert.equal(snapshot.roadNodeId, repair.id);
    const questionId = snapshot.question.id, body = submission(sessionId, questionId, `${questionId}-0`);
    const sent = await api("/api/attempts", a.cookie, "POST", body); assert.equal(sent.status, 200);
    assert.deepEqual((await api("/api/attempts", a.cookie, "POST", body)).data, sent.data);
    assert.equal(await prisma.userAttempt.count({ where: { sessionId } }), 1);
    const afterAnswer = await road(a.cookie);
    assert.deepEqual(afterAnswer.nodes.map(node => [node.id, node.key, node.reason]), first.nodes.map(node => [node.id, node.key, node.reason]));
    assert.equal(afterAnswer.nodes.find(node => node.id === repair.id)?.status, "UPCOMING");
    await completeSession(a.cookie, sessionId);
    assert.equal((await road(a.cookie)).nodes.find(node => node.id === repair.id)?.status, "COMPLETED");
    assert.equal((await road(a.cookie)).nodes[0].status, "CURRENT");
    const observationsBeforeTheory = await prisma.skillObservation.count({ where: { userId: a.id } });
    assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "complete_theory", nodeId: theory.id })).status, 200);
    assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), observationsBeforeTheory);
    assert.equal((await road(a.cookie)).nodes.find(node => node.id === repair.id)?.status, "COMPLETED");
    const review = first.nodes.find(node => node.type === "REVIEW")!;
    const reviewStart = await startNode(a.cookie, review.id), reviewSession = reviewStart.href.split("/").at(-1)!;
    const check = await prisma.learningCheck.findUniqueOrThrow({ where: { sessionId: reviewSession } });
    assert.equal(check.purpose, "review"); assert.equal(check.reviewVersion, 0);
    await completeSession(a.cookie, reviewSession);
    const schedule = await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: skill.id } } });
    assert.equal(schedule.intervalIndex, 1); assert.equal(schedule.version, 1);
    await startNode(a.cookie, review.id); // Reopening cannot create another check or advance the interval.
    assert.equal(await prisma.learningCheck.count({ where: { sessionId: reviewSession } }), 1);
    assert.equal((await road(a.cookie)).nodes.find(node => node.id === review.id)?.status, "COMPLETED");
    for (const node of (await road(a.cookie)).nodes) {
      if (node.status === "COMPLETED") continue;
      if (node.type === "THEORY") {
        assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "complete_theory", nodeId: node.id })).status, 200);
      } else {
        const started = await startNode(a.cookie, node.id);
        if (started.unavailable) {
          const evidence = await prisma.skillObservation.count({ where: { userId: a.id } });
          assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "skip_unavailable", nodeId: node.id })).status, 200);
          assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), evidence);
        } else await completeSession(a.cookie, started.href.split("/").at(-1)!);
      }
    }
    const finished = await road(a.cookie); assert.ok(finished.finished);
    assert.equal(finished.completedCount, finished.nodes.length);
    assert.ok(finished.nodes.every(node => node.status === "COMPLETED"));
    const next = await api("/api/learning-road", a.cookie, "POST", { action: "next_block" });
    assert.equal(next.status, 200); assert.equal(next.data.sequence, 2); assert.notEqual(next.data.id, first.id);
    assert.equal(await prisma.learningRoadBlock.count({ where: { userId: a.id } }), 2);
    assert.equal((await api("/api/learning-road", a.cookie, "POST", { action: "skip_unavailable", nodeId: next.data.nodes[0].id })).status, 409);

    // Initial road built AFTER diagnosis uses only those skill observations.
    const beforeDiagnostic = await road(b.cookie);
    const diagnostic = await api("/api/diagnostics", b.cookie, "POST"); assert.equal(diagnostic.status, 200);
    for (let index = 0; index < diagnostic.data.totalCount; index++) {
      snapshot = (await api(`/api/diagnostics/${diagnostic.data.id}`, b.cookie)).data;
      const exercise = await prisma.question.findUniqueOrThrow({ where: { id: snapshot.question.id }, include: { steps: { include: { options: true }, orderBy: { order: "asc" } } } });
      const result = await api(`/api/diagnostics/${diagnostic.data.id}/answers`, b.cookie, "POST", {
        submissionId: randomUUID(), revision: snapshot.revision, questionId: snapshot.question.id,
        stepAnswers: exercise.steps.map((step, position) => ({ stepId: snapshot.question.steps[position].id,
          answer: exercise.id.startsWith("diag_power") ? "999999" : step.type === "multiple_choice" ? step.options.find(o => o.isCorrect)!.id : step.expectedAnswer })) });
      assert.equal(result.status, 200, JSON.stringify(result.data));
    }
    const diagnosed = await road(b.cookie); assert.ok(!diagnosed.needsDiagnostic);
    assert.notEqual(diagnosed.id, beforeDiagnostic.id);
    assert.equal(diagnosed.sequence, beforeDiagnostic.sequence + 2, "Completed diagnostic also creates the preparation cycle");
    const archivedPractice = beforeDiagnostic.nodes.find(node => node.type === "PRACTICE")!;
    assert.equal((await api("/api/learning-road", b.cookie, "POST", { action: "start", nodeId: archivedPractice.id })).status, 409);
    assert.equal(diagnosed.nodes[0].skillId, "power_properties");
    assert.notDeepEqual(diagnosed.nodes.map(node => node.key), first.nodes.map(node => node.key));
    const insufficientNodes = diagnosed.nodes.filter(node => node.reason === "coverage" || node.reason === "evidence");
    assert.ok(insufficientNodes.length > 0);
    assert.ok(insufficientNodes.every(node => node.masteryScore === null), "One broad-screening observation does not turn unknown skills into weak skills");
    // Exhausting independently available questions is honest and cannot fabricate success.
    const checkpoint = diagnosed.nodes.find(node => node.type === "CHECKPOINT")!;
    const exposed = await prisma.questionSkill.findMany({ where: { skillId: checkpoint.skillId }, select: { questionId: true } });
    await prisma.questionHelp.createMany({ data: exposed.map(question => ({ userId: b.id, questionId: question.questionId })), skipDuplicates: true });
    const priorEvidence = await prisma.skillObservation.count({ where: { userId: b.id } });
    assert.ok((await startNode(b.cookie, checkpoint.id)).unavailable);
    assert.equal((await api("/api/learning-road", b.cookie, "POST", { action: "skip_unavailable", nodeId: checkpoint.id })).status, 200);
    const skipped = (await road(b.cookie)).nodes.find(node => node.id === checkpoint.id)!;
    assert.ok(skipped.skipped); assert.equal(skipped.outcome, null);
    assert.equal(await prisma.skillObservation.count({ where: { userId: b.id } }), priorEvidence);
    // A completed diagnostic milestone cannot replace a block after a lesson has started.
    await prisma.diagnosticSession.create({ data: { userId: b.id, status: "completed", questionIds: [], completedAt: new Date() } });
    assert.equal((await road(b.cookie)).id, diagnosed.id);

    // Additive update is repeatable, including preserved legacy and new records.
    const before = { attempts: await prisma.userAttempt.findMany({ where: { userId: a.id }, orderBy: { id: "asc" } }),
      sessions: await prisma.practiceSession.findMany({ where: { userId: a.id }, orderBy: { id: "asc" } }),
      roads: await prisma.learningRoadBlock.findMany({ where: { userId: a.id }, include: { nodes: { orderBy: { position: "asc" } } }, orderBy: { sequence: "asc" } }),
      diagnostics: await prisma.diagnosticSession.findMany({ where: { userId: b.id } }) };
    const require = createRequire(import.meta.url);
    for (let index = 0; index < 2; index++) execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file",
      "prisma/updates/20261006_adaptive_learning_road.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
    assert.deepEqual(await prisma.userAttempt.findMany({ where: { userId: a.id }, orderBy: { id: "asc" } }), before.attempts);
    assert.deepEqual(await prisma.practiceSession.findMany({ where: { userId: a.id }, orderBy: { id: "asc" } }), before.sessions);
    assert.deepEqual(await prisma.learningRoadBlock.findMany({ where: { userId: a.id }, include: { nodes: { orderBy: { position: "asc" } } }, orderBy: { sequence: "asc" } }), before.roads);
    assert.deepEqual(await prisma.diagnosticSession.findMany({ where: { userId: b.id } }), before.diagnostics);
    console.log("PASS: owned persistent blocks, concurrent starts, neutral public payloads, no manual mastery, partial/full completion, A–E idempotency, existing review intervals, diagnostic direction, next block and additive migration");
  } finally { await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
