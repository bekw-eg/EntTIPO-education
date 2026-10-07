import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { DIAGNOSTIC_EXERCISES } from "../lib/skillCatalog";
import { seedSkills } from "../prisma/skillSeed";

const prisma = new PrismaClient();
const base = process.env.SKILLS_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const runId = `skills-test-${randomUUID()}`;
const users: string[] = [];
async function api(path: string, cookie?: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return { status: response.status, data: await response.json(), response };
}
async function register(label: string) {
  const result = await api("/api/auth/register", undefined, "POST", { name: label, email: `${runId}-${label}@example.test`, password: "test-password-123" });
  assert.equal(result.status, 200); users.push(result.data.user.id);
  return { id: result.data.user.id as string, cookie: result.response.headers.get("set-cookie")!.split(";")[0] };
}
function noKey(data: unknown) {
  assert.doesNotMatch(JSON.stringify(data), /expectedAnswer|correctAnswer|isCorrect|explanation|feedback|misconceptions|"hint"/);
}
async function main() {
  assert.equal((await api("/api/diagnostics")).status, 401);
  assert.equal((await api("/api/skills")).status, 401);
  const a = await register("A"), b = await register("B");
  const starts = await Promise.all(Array.from({ length: 4 }, () => api("/api/diagnostics", a.cookie, "POST")));
  starts.forEach((s) => { assert.equal(s.status, 200); assert.equal(s.data.id, starts[0].data.id); });
  const sa = starts[0].data;
  const sb = (await api("/api/diagnostics", b.cookie, "POST")).data;
  assert.notEqual(sa.id, sb.id); assert.ok(sa.questionIds.length > 9); noKey(sa);
  assert.ok(DIAGNOSTIC_EXERCISES.every(q => sa.questionIds.includes(q.id)), "Original three-skill screening remains covered");
  assert.equal(await prisma.diagnosticSession.count({ where: { userId: a.id } }), 1);
  const path = `/api/diagnostics/${sa.id}`;
  assert.equal((await api(path, b.cookie)).status, 404);
  assert.equal((await api(path, b.cookie, "PATCH", { revision: 0, currentIndex: 0, answers: {} })).status, 404);
  assert.equal((await api(`${path}/answers`, b.cookie, "POST", { submissionId: randomUUID(), questionId: sa.question.id,
    revision: 0, stepAnswers: sa.question.steps.map((s: any) => ({ stepId: s.id, answer: "x^5" })) })).status, 404);
  assert.ok((await api("/api/skills", b.cookie)).data.every((s: any) => s.state === "insufficient" && s.observationCount === 0));
  assert.equal((await api("/api/ai/tutor", a.cookie, "POST", { action: "hint", questionId: sa.question.id })).status, 403);
  assert.equal((await api(`/api/sessions/${sa.id}/hint`, a.cookie, "POST", { questionId: sa.question.id })).status, 404);
  assert.equal((await api(`${path}/answers`, a.cookie, "POST", { submissionId: randomUUID(), questionId: sa.question.id,
    revision: 0, usedHint: true, stepAnswers: sa.question.steps.map((s: any) => ({ stepId: s.id, answer: "x^5" })) })).status, 400);

  const draft = { [sa.question.steps[0].id]: "x^(" };
  assert.equal((await api(path, a.cookie, "PATCH", { revision: 0, currentIndex: 0, answers: draft })).status, 200);
  let state = (await api(path, a.cookie)).data;
  assert.deepEqual(state.draftAnswers, draft); assert.equal(state.revision, 1); noKey(state);
  assert.equal((await api(path, a.cookie, "PATCH", { revision: 0, currentIndex: 0, answers: {} })).status, 409);
  assert.equal((await api(path, a.cookie, "PATCH", { revision: 1, currentIndex: 0, answers: { foreign: "2" } })).status, 400);
  assert.equal((await api(`${path}/answers`, a.cookie, "POST", { submissionId: randomUUID(), questionId: sa.questionIds[1],
    revision: 1, stepAnswers: [{ stepId: `${sa.questionIds[1]}_step_1`, answer: "9" }] })).status, 409);
  let firstPayload: any;
  for (let index = 0; index < sa.questionIds.length; index++) {
    state = (await api(path, a.cookie)).data; assert.equal(state.currentIndex, index); noKey(state);
    const exercise = DIAGNOSTIC_EXERCISES.find((q) => q.id === state.question.id);
    const q = await prisma.question.findUniqueOrThrow({ where: { id: state.question.id }, include: { steps: { include: { options: true } } } });
    const payload = { submissionId: randomUUID(), questionId: q.id, revision: state.revision,
      stepAnswers: q.steps.map(step => ({ stepId: step.id, answer: exercise && exercise.steps[0].skillIds[0] !== "power_properties" ? exercise.steps[0].misconceptions[0].answer
        : step.type === "multiple_choice" ? step.options.find(o => o.isCorrect)!.id : step.expectedAnswer })) };
    const copies = await Promise.all(Array.from({ length: index === 0 || index === sa.questionIds.length - 1 ? 4 : 1 }, () => api(`${path}/answers`, a.cookie, "POST", payload)));
    for (const copy of copies) { assert.equal(copy.status, 200); assert.deepEqual(copy.data, { accepted: true, questionId: q.id }); noKey(copy.data); }
    if (index === 0) firstPayload = payload;
    assert.equal((await api(`${path}/answers`, a.cookie, "POST", { ...payload, submissionId: randomUUID() })).status, 409);
    assert.equal(await prisma.diagnosticAnswer.count({ where: { sessionId: sa.id } }), index + 1);
    if (index < sa.questionIds.length - 1) {
      assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), 0);
      assert.equal((await api(path, a.cookie)).data.result, null);
    }
  }
  const completed = (await api(path, a.cookie)).data;
  assert.equal(completed.status, "completed"); assert.equal(completed.currentIndex, sa.questionIds.length);
  assert.equal(completed.result.correctCount, sa.questionIds.length - 6);
  assert.deepEqual((await api(path, a.cookie)).data.result, completed.result, "Saved report survives reload");
  assert.equal((await api("/api/diagnostics", a.cookie, "POST")).data.id, sa.id);
  const power = completed.result.skills.find((s: any) => s.id === "power_properties");
  const signs = completed.result.skills.find((s: any) => s.id === "bracket_signs");
  const chain = completed.result.skills.find((s: any) => s.id === "chain_rule");
  assert.equal(power.assessment, "no_gap_observed"); assert.notEqual(power.state, "mastered");
  for (const skill of [signs, chain]) {
    assert.equal(skill.assessment, "gap_observed"); assert.equal(skill.evidence.length, 3);
    assert.ok(skill.evidence.every((e: any) => !e.isCorrect && e.skillIds.includes(skill.id) && e.feedback.ru && e.feedback.kk));
    assert.ok(await prisma.questionSkill.findUnique({ where: { questionId_skillId: { questionId: skill.recommendation.id, skillId: skill.id } } }));
  }
  assert.match(signs.evidence[0].feedback.ru, /не поменял знак второго слагаемого/);
  assert.match(chain.evidence[0].feedback.ru, /не умножил на производную внутренней/);
  assert.equal(signs.recommendation.id, "practice_sign_sum", "A sum-sign error leads to another sum-sign task");
  assert.equal(chain.recommendation.id, "practice_chain_linear");
  const observationCount = completed.result.skills.reduce((sum: number, s: any) => sum + s.observationCount, 0);
  assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), observationCount);
  assert.equal(await prisma.userAttempt.count({ where: { userId: a.id } }), 0, "Entrance answers are separate from practice attempts");
  assert.equal((await api(`${path}/answers`, a.cookie, "POST", firstPayload)).status, 200);
  assert.equal((await api(`${path}/answers`, a.cookie, "POST", { ...firstPayload, stepAnswers: [{ ...firstPayload.stepAnswers[0], answer: "bad" }] })).status, 409);
  assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), observationCount);
  assert.equal((await api(path, a.cookie, "PATCH", { revision: completed.revision, currentIndex: sa.questionIds.length, answers: {} })).status, 409);
  assert.equal((await api(`/api/diagnostics/${sb.id}`, b.cookie)).data.currentIndex, 0);

  for (let index = 0; index < sb.questionIds.length; index++) {
    const other = (await api(`/api/diagnostics/${sb.id}`, b.cookie)).data;
    const question = await prisma.question.findUniqueOrThrow({ where: { id: other.question.id }, include: { steps: { include: { options: true } } } });
    assert.equal((await api(`/api/diagnostics/${sb.id}/answers`, b.cookie, "POST", { submissionId: randomUUID(), revision: other.revision,
      questionId: other.question.id, stepAnswers: question.steps.map(s => ({ stepId: s.id, answer: s.type === "multiple_choice" ? s.options.find(o => o.isCorrect)!.id : s.expectedAnswer })) })).status, 200);
  }
  const bReport = (await api(`/api/diagnostics/${sb.id}`, b.cookie)).data.result;
  assert.equal(bReport.correctCount, sb.questionIds.length);
  assert.ok(bReport.skills.every((s: any) => s.state !== "mastered" && s.evidence.every((e: any) => e.isCorrect)));
  assert.ok(bReport.skills.filter((s: any) => s.distinctQuestions >= 3).every((s: any) => s.assessment === "no_gap_observed"));
  assert.ok(bReport.skills.filter((s: any) => s.distinctQuestions < 3).every((s: any) => s.assessment === "insufficient"));
  const bProgress = (await api("/api/skills", b.cookie)).data;
  for (const mode of ["weak_topics", "mixed"]) {
    const selected = await api("/api/sessions", a.cookie, "POST", { mode, totalCount: 5 }); assert.equal(selected.status, 200);
    const questions = await prisma.question.findMany({ where: { id: { in: selected.data.questionIds } }, include: { skills: true } });
    assert.ok(questions.every((q) => q.purpose === "practice"));
    assert.ok(questions.some((q) => q.skills.some((s) => s.skillId === "bracket_signs")));
    assert.ok(questions.some((q) => q.skills.some((s) => s.skillId === "chain_rule")));
  }
  assert.equal((await api("/api/sessions", a.cookie, "POST", { mode: "mixed", totalCount: 1, skillId: "chain_rule", questionId: "practice_power_product" })).status, 400);
  const practice = await api("/api/sessions", a.cookie, "POST", { mode: "mixed", totalCount: 1,
    skillId: "bracket_signs", questionId: "practice_power_and_signs" }); assert.equal(practice.status, 200);
  const ps = practice.data.id;
  const q = (await api(`/api/sessions/${ps}`, a.cookie)).data.question;
  const partial = { submissionId: randomUUID(), sessionId: ps, questionId: q.id,
    stepAnswers: [{ stepId: q.steps[0].id, answer: q.steps[0].options.find((o: any) => o.text === "-x^5+4").id }] };
  const graded = await api("/api/attempts", a.cookie, "POST", partial); assert.equal(graded.status, 200);
  assert.equal(graded.data.score, 0); assert.equal(graded.data.isPartial, false);
  const mistake = await prisma.mistake.findFirstOrThrow({ where: { attemptId: graded.data.attemptId } });
  assert.equal(mistake.skillId, "bracket_signs"); assert.equal(mistake.stepId, null);
  assert.match(mistake.explanation!, /не поменял знак второго слагаемого/);
  const outcomes = await prisma.skillObservation.findMany({ where: { attemptId: graded.data.attemptId } });
  assert.equal(outcomes.find((o) => o.skillId === "power_properties")!.score, 0);
  assert.equal(outcomes.find((o) => o.skillId === "bracket_signs")!.score, 0);
  assert.equal((await api(`/api/sessions/${ps}/hint`, a.cookie, "POST", { questionId: q.id })).status, 200);
  let practiceState = (await api(`/api/sessions/${ps}`, a.cookie)).data;
  assert.equal((await api(`/api/sessions/${ps}/state`, a.cookie, "PATCH", { action: "retry", revision: practiceState.revision })).status, 200);
  const correctPayload = { ...partial, submissionId: randomUUID(), stepAnswers: [{ stepId: q.steps[0].id,
    answer: q.steps[0].options.find((o: any) => o.text === "-x^5-4").id }] };
  const retry = await api("/api/attempts", a.cookie, "POST", correctPayload); assert.equal(retry.status, 200);
  assert.equal(retry.data.usedHint, true); assert.equal(retry.data.attemptNumber, 2);
  const retryObservations = await prisma.skillObservation.findMany({ where: { attemptId: retry.data.attemptId } });
  assert.ok(retryObservations.every((o) => o.usedHint && o.attemptNumber === 2));
  assert.equal((await api("/api/attempts", a.cookie, "POST", correctPayload)).status, 200);
  assert.equal(await prisma.skillObservation.count({ where: { attemptId: retry.data.attemptId } }), 2);
  const anotherSession = await api("/api/sessions", a.cookie, "POST", { mode: "mixed", totalCount: 1,
    skillId: "bracket_signs", questionId: q.id });
  const acrossSessions = await api("/api/attempts", a.cookie, "POST", { ...correctPayload, submissionId: randomUUID(), sessionId: anotherSession.data.id });
  assert.equal(acrossSessions.status, 200);
  assert.ok((await prisma.skillObservation.findMany({ where: { attemptId: acrossSessions.data.attemptId } })).every((o) => o.attemptNumber === 3),
    "Restarting practice does not reset the skill's retry penalty");
  assert.deepEqual((await api("/api/skills", b.cookie)).data, bProgress, "Practice in A cannot change B's skill progress");

  const historical = await prisma.mistake.create({ data: { userId: a.id, questionId: q.id, topicId: q.topicId,
    weakSkill: "приблизительный_старый_навык", errorType: "algebra_error", description: "Legacy history fixture" } });
  const beforeAnswers = await prisma.diagnosticAnswer.findMany({ where: { sessionId: sa.id } });
  const beforeQuestions = await prisma.question.count();
  const require = createRequire(import.meta.url);
  for (let i = 0; i < 2; i++) {
    execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file",
      "prisma/updates/20261004_skill_diagnostics.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
    await seedSkills(prisma);
  }
  assert.deepEqual(await prisma.mistake.findUnique({ where: { id: historical.id } }), historical);
  assert.deepEqual(await prisma.diagnosticAnswer.findMany({ where: { sessionId: sa.id } }), beforeAnswers);
  assert.equal(await prisma.question.count(), beforeQuestions);
  assert.deepEqual((await api(path, a.cookie)).data.result, completed.result);
  console.log("PASS: isolated accounts, original nine tasks plus mapped coverage, disabled hints/AI, delayed answer keys, saved drafts/cursor/report, concurrency and idempotency");
  console.log("PASS: explicitly mapped choice mistakes, binary practice scores, hints/retries, linked adaptive tasks, conservative evidence and additive repeatable migration");
}
async function cleanup() {
  const verified = await prisma.user.findMany({ where: { id: { in: users }, email: { startsWith: runId } }, select: { id: true } });
  const where = { userId: { in: verified.map((u) => u.id) } };
  await prisma.$transaction(async (tx) => {
    await tx.mistake.deleteMany({ where });
    await tx.userStepAnswer.deleteMany({ where: { attempt: where } });
    await tx.userAttempt.deleteMany({ where });
    await tx.practiceSession.deleteMany({ where });
    await tx.userTopicProgress.deleteMany({ where });
    await tx.dailyGoal.deleteMany({ where });
    await tx.diagnosticSession.deleteMany({ where });
    await tx.user.deleteMany({ where: { id: { in: where.userId.in }, email: { startsWith: runId } } });
  });
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { await cleanup(); } catch (e) { console.error("Could not clean up skill fixtures", e); process.exitCode = 1; }
  await prisma.$disconnect();
});
