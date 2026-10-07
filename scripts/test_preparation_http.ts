import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { api, prisma, noKeys } from "./choice_test_fixture";
import { completeSession } from "./road_test_fixture";
import { preparationFixture, preparation, finishDiagnostic, startCheck, finishCheck } from "./preparation_test_fixture";
import { recordQuestionHelp } from "../lib/practiceStorage";
import type { PaperQuestion } from "../lib/exam/mode";
import { SKILL_PREREQUISITES } from "../lib/learning-road/graph";

async function main() {
  const f = await preparationFixture();
  let returningId: string | undefined;
  try {
    assert.equal((await api("/api/preparation")).status, 401);
    assert.equal((await preparation(f.b.cookie)).stage, "diagnostic_needed");
    const diagnostic = (await api("/api/diagnostics", f.b.cookie, "POST", {})).data;
    assert.ok(diagnostic.totalCount > 9, "Expanded coverage is based on the actual mapped bank"); noKeys(diagnostic);
    assert.equal((await preparation(f.b.cookie)).stage, "diagnostic_active");
    const first = diagnostic.question.steps[0];
    assert.equal((await api(`/api/diagnostics/${diagnostic.id}`, f.b.cookie, "PATCH", { revision: 0, currentIndex: 0, answers: { [first.id]: "draft" } })).status, 200);
    assert.equal((await api(`/api/diagnostics/${diagnostic.id}`, f.b.cookie)).data.draftAnswers[first.id], "draft");
    assert.equal((await api(`/api/diagnostics/${diagnostic.id}`, f.a.cookie)).status, 404);
    const report = await finishDiagnostic(f.b.cookie, true);
    assert.equal(report.status, "completed");
    const evidenceCounts = report.result.skills.map((s: any) => s.distinctQuestions);
    assert.ok(evidenceCounts.some((n: number) => n === 1));
    assert.ok(report.result.skills.filter((s: any) => s.distinctQuestions < 3).every((s: any) => s.state === "insufficient"));
    assert.ok(report.result.skills.some((s: any) => s.state === "weak"));
    const roads = await Promise.all([preparation(f.b.cookie), preparation(f.b.cookie), preparation(f.b.cookie)]);
    assert.ok(roads.every(r => r.id === roads[0].id));
    assert.equal(await prisma.learningRoadBlock.count({ where: { userId: f.b.id, programVersion: 1 } }), 1);
    assert.ok(roads[0].nodes.some(n => n.type === "FINAL"));
    const roots = roads[0].nodes.findIndex(n => n.skillId === "exam_nth_roots" && n.type === "SKILL");
    const irrational = roads[0].nodes.findIndex(n => n.skillId === "exam_irrational_transformations" && n.type === "SKILL");
    assert.ok(roots >= 0 && roots < irrational);
    console.log("PASS real bank diagnostic → saved program; insufficient vs weak; prerequisites; reload/idempotency; account isolation.");

    const cycle = await f.cycle();
    let road = await preparation(f.a.cookie), current = road.nodes.find(n => n.status === "current")!;
    const final = road.nodes.find(n => n.type === "FINAL")!;
    assert.equal((await api("/api/preparation", f.a.cookie, "POST", { nodeId: final.id, action: "check", requestId: randomUUID() })).status, 409);
    assert.equal((await api("/api/preparation", f.b.cookie, "POST", { nodeId: current.id, action: "check", requestId: randomUUID() })).status, 404);
    assert.equal((await api("/api/learning-road", f.a.cookie, "POST", { nodeId: current.id, action: "start" })).status, 404, "Legacy endpoint cannot bypass program gates");
    assert.equal((await api("/api/preparation", f.a.cookie, "POST", { nodeId: current.id, action: "practice", requestId: randomUUID() })).status, 409);
    const requestId = randomUUID();
    const starts = await Promise.all([1, 2, 3, 4].map(() => startCheck(f.a.cookie, current.id, requestId)));
    assert.ok(starts.every(s => s.href === starts[0].href));
    const failedId = starts[0].href.split("/").at(-1)!;
    const snapshot = (await api(`/api/exams/${failedId}`, f.a.cookie)).data;
    noKeys(snapshot); assert.ok(!JSON.stringify(snapshot).includes("correctIndex"));
    assert.equal(snapshot.questions.length, 4); assert.equal(snapshot.questions[0].options.length, 5);
    assert.equal((await api(`/api/exams/${failedId}`, f.b.cookie)).status, 404);
    assert.equal((await api("/api/ai/tutor", f.a.cookie, "POST", { action: "hint", questionId: snapshot.questions[0].id })).status, 403);
    const save = { requestId: randomUUID(), revision: snapshot.revision, currentIndex: 1, answers: { [snapshot.questions[0].id]: 4 }, flaggedQuestionIds: [] };
    assert.equal((await api(`/api/exams/${failedId}`, f.a.cookie, "PATCH", save)).status, 200);
    assert.equal((await api(`/api/exams/${failedId}`, f.a.cookie)).data.currentIndex, 1);
    assert.equal((await api(`/api/exams/${failedId}`, f.a.cookie, "PATCH", { ...save, requestId: randomUUID() })).status, 409);
    const fail = await finishCheck(f.a.cookie, failedId, current.skillId);
    assert.equal(fail.result.preparation.passed, false);
    const repeated = await Promise.all([1, 2, 3].map(() => api(`/api/exams/${failedId}/finish`, f.a.cookie, "POST", {})));
    assert.ok(repeated.every(r => r.status === 200 && JSON.stringify(r.data.result) === JSON.stringify(fail.result)));
    assert.equal(await prisma.skillObservation.count({ where: { examSessionId: failedId } }), 4);
    assert.equal((await startCheck(f.a.cookie, current.id, requestId)).href, starts[0].href);
    road = await preparation(f.a.cookie); current = road.nodes.find(n => n.status === "current")!;
    assert.equal(current.phase, "repair"); assert.equal(road.confirmedSkillIds.length, 0);
    assert.equal((await api("/api/preparation", f.a.cookie, "POST", { nodeId: current.id, action: "check", requestId: randomUUID() })).status, 409);
    const practices = await Promise.all([1, 2, 3].map(() => api("/api/preparation", f.a.cookie, "POST", { nodeId: current.id, action: "practice", requestId: randomUUID() })));
    assert.ok(practices.every(p => p.status === 200 && p.data.href === practices[0].data.href));
    const practiceId = practices[0].data.href.split("/").at(-1)!;
    await completeSession(f.a.cookie, practiceId);
    const repaired = await preparation(f.a.cookie);
    assert.equal(repaired.nodes.find(n => n.id === current.id)!.phase, "check");
    assert.equal(repaired.confirmedSkillIds.length, 0, "Learning attempts do not confirm a skill");
    const helped = await prisma.question.findFirstOrThrow({ where: { skills: { some: { skillId: current.skillId } } }, orderBy: { id: "desc" } });
    await recordQuestionHelp(f.a.id, helped.id);
    const second = await startCheck(f.a.cookie, current.id), secondId = second.href.split("/").at(-1)!;
    const secondExam = await prisma.examSession.findUniqueOrThrow({ where: { id: secondId } });
    assert.ok(secondExam.questionIds.every(id => id !== helped.id && !snapshot.questions.some((q: any) => q.id === id)));
    assert.equal((await finishCheck(f.a.cookie, secondId)).result.preparation.passed, true);
    road = await preparation(f.a.cookie); assert.equal(road.confirmedSkillIds.length, 1);
    while ((current = road.nodes.find(n => n.status === "current")!).type === "SKILL") {
      const start = await startCheck(f.a.cookie, current.id); assert.ok(start.href, JSON.stringify(start));
      await finishCheck(f.a.cookie, start.href.split("/").at(-1)!); road = await preparation(f.a.cookie);
    }
    assert.equal(current.type, "MIXED"); assert.equal(road.confirmedSkillIds.length, 3);
    const mixed = await startCheck(f.a.cookie, current.id), mixedId = mixed.href.split("/").at(-1)!;
    const mixedExam = await prisma.examSession.findUniqueOrThrow({ where: { id: mixedId } });
    assert.equal(mixedExam.questionIds.length, 6);
    const failedSkill = current.skillIds[0];
    const mixedResult = await finishCheck(f.a.cookie, mixedId, failedSkill);
    assert.deepEqual(mixedResult.result.preparation.gapSkillIds, [failedSkill]);
    road = await preparation(f.a.cookie); current = road.nodes.find(n => n.status === "current")!;
    assert.deepEqual(current.repairSkillIds, [failedSkill]);
    assert.equal(road.nodes.filter(n => n.type === "SKILL" && n.status === "confirmed").length, 3, "Successful blocks remain intact");
    const repair = await api("/api/preparation", f.a.cookie, "POST", { nodeId: current.id, action: "practice", requestId: randomUUID() });
    assert.equal(repair.status, 200); await completeSession(f.a.cookie, repair.data.href.split("/").at(-1)!);
    await preparation(f.a.cookie);
    const mixedRetry = await startCheck(f.a.cookie, current.id); await finishCheck(f.a.cookie, mixedRetry.href.split("/").at(-1)!);
    road = await preparation(f.a.cookie); assert.equal(road.stage, "final_ready");
    const exam = await startCheck(f.a.cookie, final.id), examId = exam.href.split("/").at(-1)!;
    const finalPaper = (await prisma.examSession.findUniqueOrThrow({ where: { id: examId } })).paper as unknown as PaperQuestion[];
    assert.equal(finalPaper.length, 20); assert.ok(finalPaper.every(q => q.options.length === 4));
    const result = await finishCheck(f.a.cookie, examId, undefined, true);
    assert.equal(result.result.points, 0); assert.equal(result.result.preparation.next, "reinforcement");
    const renewed = await preparation(f.a.cookie);
    assert.equal(renewed.stage, "reinforcement"); assert.notEqual(renewed.id, cycle.id);
    const expectedSkills = new Set(finalPaper.flatMap(q => q.skillIds));
    for (const id of expectedSkills) for (const prerequisite of SKILL_PREREQUISITES[id] ?? []) expectedSkills.add(prerequisite);
    assert.deepEqual(renewed.nodes.filter(n => n.type === "SKILL").map(n => n.skillId).sort(), [...expectedSkills].sort());
    assert.equal(renewed.confirmedSkillIds.length, 3, "Only final gaps receive new blocks");
    await api(`/api/exams/${examId}/finish`, f.a.cookie, "POST", {});
    assert.equal(await prisma.learningRoadBlock.count({ where: { sourceExamId: examId } }), 1);
    console.log("PASS full controlled path: checks, assistance exclusion, failed check → real practice → new check, mixed remediation, final timer/persistence/results and targeted next cycle.");

    // Honest content exhaustion: assistance excludes every remaining control candidate.
    const bNode = roads[0].nodes.find(n => n.status === "current")!;
    const all = await prisma.question.findMany({ where: { skills: { some: { skillId: bNode.skillId } } }, select: { id: true } });
    await prisma.questionHelp.createMany({ data: all.map(q => ({ userId: f.b.id, questionId: q.id })), skipDuplicates: true });
    const shortage = await startCheck(f.b.cookie, bNode.id);
    assert.equal(shortage.unavailable, true); assert.ok(shortage.shortages.length);
    assert.equal((await preparation(f.b.cookie)).nodes.find(n => n.id === bNode.id)!.status, "current");
    assert.equal(await prisma.examSession.count({ where: { userId: f.b.id } }), 0);
    // A returning learner's genuinely sufficient *fixture evidence* credits a block at program creation.
    const returning = await api("/api/auth/register", "", "POST", { name: "Returning", email: `${f.run}-returning@example.test`, password: "returning-password" });
    assert.equal(returning.status, 200); returningId = returning.data.user.id;
    const returningCookie = returning.response.headers.get("set-cookie")!.split(";")[0];
    await prisma.diagnosticSession.create({ data: { userId: returningId!, status: "completed", questionIds: [], completedAt: new Date(), result: {} } });
    const evidenceQuestions = await prisma.question.findMany({ where: { skills: { some: { skillId: f.skill.id } } }, take: 12, orderBy: { id: "asc" } });
    await prisma.skillObservation.createMany({ data: evidenceQuestions.map((q, i) => ({ userId: returningId!, skillId: f.skill.id, questionId: q.id,
      score: 100, isCorrect: true, isPartial: false, usedHint: false, difficulty: 1, attemptNumber: 1, createdAt: new Date(Date.now() - (12 - i) * 1000) })) });
    const credited = (await preparation(returningCookie)).nodes.find(n => n.type === "SKILL" && n.skillId === f.skill.id)!;
    assert.equal(credited.status, "confirmed"); assert.equal(credited.assessments.length, 0);
    assert.equal((credited.evidence as { source: string }).source, "existing_mastery");
    // The successful final has a distinct terminal state and does not invent a new cycle.
    const successCycle = await f.cycle(f.b.id);
    let successRoad = await preparation(f.b.cookie);
    while (successRoad.stage !== "completed") {
      const node = successRoad.nodes.find(n => n.status === "current")!;
      const start = await startCheck(f.b.cookie, node.id); assert.ok(start.href, JSON.stringify(start));
      const result = await finishCheck(f.b.cookie, start.href.split("/").at(-1)!);
      assert.equal(result.result.preparation.passed, true);
      successRoad = await preparation(f.b.cookie);
    }
    assert.equal(successRoad.id, successCycle.id);
    assert.equal(successRoad.history.filter(c => c.id === successCycle.id)[0].status, "completed");
    // Repeat additive migration and prove history remains byte-for-byte stable.
    const before = await prisma.examSession.findMany({ where: { userId: f.a.id }, orderBy: { id: "asc" } });
    const require = createRequire(import.meta.url);
    for (let i = 0; i < 2; i++) execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file", "prisma/updates/20261007_preparation_program.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
    assert.deepEqual(await prisma.examSession.findMany({ where: { userId: f.a.id }, orderBy: { id: "asc" } }), before);
    console.log("PASS explicit content shortage, no fake confirmation, additive repeatable migration and preserved history.");
  } finally {
    try { if (returningId) { await prisma.dailyGoal.deleteMany({ where: { userId: returningId } }); await prisma.user.delete({ where: { id: returningId } }); } }
    finally { await f.cleanup(); }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
