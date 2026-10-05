import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { TIPO_MATH } from "../lib/exam/profile";
import type { PaperQuestion } from "../lib/exam/mode";

const prisma = new PrismaClient(), base = process.env.EXAM_TEST_BASE_URL ?? "http://127.0.0.1:3100";
const users: { id: string; cookie: string; email: string }[] = [];
let changedQuestion: { id: string; explanation: string } | null = null;
async function api(path: string, cookie?: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  const data = await response.json(); return { response, status: response.status, data };
}
async function register(name: string) {
  const email = `exam-mode-${name}-${randomUUID()}@example.test`;
  const r = await api("/api/auth/register", undefined, "POST", { name, email, password: "exam-mode-password-123" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const user = { id: r.data.user.id as string, cookie: r.response.headers.get("set-cookie")!.split(";")[0], email };
  users.push(user); return user;
}
const settings = () => ({ requestId: randomUUID(), profileId: TIPO_MATH.id, profileVersion: TIPO_MATH.version, language: "ru", durationMinutes: 40 });
function noKeys(value: unknown) {
  const text = JSON.stringify(value); for (const field of ["correctIndex", "correctAnswer", "expectedAnswer", "isCorrect", "explanation", "hint", "paper"]) assert.ok(!text.includes(`"${field}"`), field);
}
async function main() {
  for (const path of ["/api/exams", "/api/exams/unknown"]) assert.equal((await api(path)).status, 401);
  assert.equal((await api("/api/exams/unknown/finish", undefined, "POST", {})).status, 401);
  const a = await register("A"), b = await register("B"), c = await register("C");
  const initialPlan = (await api("/api/learning-plan", a.cookie)).data;
  assert.equal(initialPlan.actions[0].kind, "diagnostic");
  const practiceQuestion = await prisma.question.findUniqueOrThrow({ where: { id: "exam_v1_derivative_fraction" }, include: { steps: { include: { options: true } } } });
  const practice = await api("/api/sessions", a.cookie, "POST", { mode: "mixed", totalCount: 1, questionId: practiceQuestion.id, skillId: "exam_derivative_rules" });
  assert.equal(practice.status, 200); const practiceId = practice.data.id;
  const oldAttempt = await api("/api/attempts", a.cookie, "POST", { submissionId: randomUUID(), sessionId: practiceId, questionId: practiceQuestion.id,
    stepAnswers: [{ stepId: practiceQuestion.steps[0].id, answer: practiceQuestion.steps[0].options.find((o) => !o.isCorrect)!.id }] });
  assert.equal(oldAttempt.status, 200);
  const beforeObservations = await prisma.skillObservation.count({ where: { userId: a.id } });
  const counters = { attempts: await prisma.userAttempt.count({ where: { userId: a.id } }),
    topic: await prisma.userTopicProgress.findMany({ where: { userId: a.id } }), goals: await prisma.dailyGoal.findMany({ where: { userId: a.id } }) };
  const starts = await Promise.all(Array.from({ length: 4 }, () => api("/api/exams", a.cookie, "POST", settings())));
  starts.forEach((r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.id, starts[0].data.id); });
  let state = starts[0].data; const id = state.id, path = `/api/exams/${id}`;
  assert.match(starts[0].response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(await prisma.examSession.count({ where: { userId: a.id } }), 1);
  assert.equal(state.questions.length, 20); noKeys(state);
  assert.equal(new Set(state.questions.map((q: any) => q.id)).size, 20);
  assert.equal(new Set(state.questions.map((q: any) => q.pointCode)).size, 20);
  for (const band of ["A", "B", "C"] as const) assert.equal(state.questions.filter((q: any) => q.band === band).length, TIPO_MATH.official.difficultyCounts[band]);
  assert.equal(new Date(state.deadlineAt).getTime() - new Date(state.startedAt).getTime(), 40 * 60000);
  const record = await prisma.examSession.findUniqueOrThrow({ where: { id } }), paper = record.paper as unknown as PaperQuestion[];
  assert.equal(new Set(paper.map((q) => q.contentHash)).size, 20);
  assert.equal(paper.find((q) => q.id === practiceQuestion.id)!.previouslyExposed, true);
  // Owner scope for every read and mutation.
  for (const [method, body, route] of [["GET", undefined, path], ["PATCH", { requestId: randomUUID(), revision: 0, currentIndex: 0, answers: {}, flaggedQuestionIds: [] }, path], ["POST", {}, `${path}/finish`]] as const) assert.equal((await api(route, b.cookie, method, body)).status, 404);
  assert.equal((await api("/api/exams", a.cookie, "POST", { ...settings(), language: "kk" })).status, 400);
  assert.equal((await api("/api/exams", a.cookie, "POST", { ...settings(), profileVersion: "wrong" })).status, 404);
  const firstQuestion = paper[0];
  const save = { requestId: randomUUID(), revision: state.revision, currentIndex: 3, answers: { [firstQuestion.id]: firstQuestion.correctIndex }, flaggedQuestionIds: [firstQuestion.id, paper[3].id] };
  const saves = await Promise.all(Array.from({ length: 3 }, () => api(path, a.cookie, "PATCH", save)));
  saves.forEach((r) => { assert.equal(r.status, 200); assert.equal(r.data.revision, state.revision + 1); assert.deepEqual(r.data.answers, save.answers); noKeys(r.data); });
  state = saves[0].data;
  assert.equal((await api(path, a.cookie, "PATCH", { ...save, answers: {} })).status, 409);
  assert.equal((await api(path, a.cookie, "PATCH", { ...save, requestId: randomUUID() })).status, 409);
  for (const tamper of [{ deadlineAt: "2099-01-01" }, { durationMinutes: 120 }, { remainingSeconds: 999999 }, { startedAt: "2099-01-01" }]) {
    assert.equal((await api(path, a.cookie, "PATCH", { ...save, revision: state.revision, ...tamper })).status, 400);
  }
  assert.equal((await api(path, a.cookie, "PATCH", { ...save, requestId: randomUUID(), revision: state.revision, answers: { unrelated: 0 } })).status, 400);
  await api("/api/auth/logout", a.cookie, "POST");
  const login = await api("/api/auth/login", undefined, "POST", { email: a.email, password: "exam-mode-password-123" });
  assert.equal(login.status, 200); a.cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  const restored = await api(path, a.cookie);
  assert.deepEqual(restored.data.questions, state.questions); assert.deepEqual(restored.data.answers, save.answers);
  assert.deepEqual(restored.data.flaggedQuestionIds, save.flaggedQuestionIds); assert.equal(restored.data.currentIndex, 3);
  assert.equal(restored.data.deadlineAt, state.deadlineAt); assert.ok(restored.data.remainingSeconds <= state.remainingSeconds);
  // Exam-ID and ordinary-session bypasses, saved answer replays, generic and specific AI all fail.
  const blockedAttempt = { submissionId: randomUUID(), sessionId: practiceId, questionId: practiceQuestion.id,
    stepAnswers: [{ stepId: practiceQuestion.steps[0].id, answer: practiceQuestion.steps[0].options[0].id }] };
  assert.equal((await api("/api/attempts", a.cookie, "POST", blockedAttempt)).status, 403);
  assert.equal((await api("/api/attempts", a.cookie, "POST", { ...blockedAttempt, sessionId: id })).status, 403);
  assert.equal((await api(`/api/attempts?sessionId=${practiceId}`, a.cookie)).status, 403);
  assert.equal((await api(`/api/sessions/${practiceId}`, a.cookie)).status, 403);
  assert.equal((await api(`/api/sessions/${practiceId}/next-question`, a.cookie)).status, 403);
  assert.equal((await api(`/api/sessions/${practiceId}/hint`, a.cookie, "POST", { questionId: practiceQuestion.id })).status, 403);
  for (const body of [{ action: "hint", questionId: firstQuestion.id }, { action: "chat", userMessage: firstQuestion.questionText }, { action: "analyze_error", attemptId: oldAttempt.data.attemptId }]) {
    assert.equal((await api("/api/ai/tutor", a.cookie, "POST", body)).status, 403);
  }
  assert.equal((await api("/api/mistakes", a.cookie)).status, 403);
  assert.equal((await api("/api/skills", a.cookie)).status, 403);
  assert.equal((await api("/api/learning-plan", a.cookie)).status, 403);
  const dashboardDuringExam = await api("/api/dashboard", a.cookie);
  assert.equal(dashboardDuringExam.status, 200);
  const dashboardText = JSON.stringify(dashboardDuringExam.data);
  for (const field of ["correctAnswer", "expectedAnswer", "submissionResult", "explanation"]) assert.ok(!dashboardText.includes(`"${field}"`), `Dashboard leaked ${field}`);
  const oldMistake = await prisma.mistake.findFirstOrThrow({ where: { userId: a.id, attemptId: oldAttempt.data.attemptId } });
  assert.equal((await api(`/api/mistakes/${oldMistake.id}`, a.cookie, "PATCH", { isReviewed: true })).status, 403);
  const changeAnswers: Record<string, number> = {};
  for (const [index, q] of paper.entries()) if (index < 12) changeAnswers[q.id] = q.correctIndex;
  else if (index < 16) changeAnswers[q.id] = (q.correctIndex + 1) % 4;
  // Persist a changed answer, flag list and position; later answer keys must use the frozen content.
  const updated = await api(path, a.cookie, "PATCH", { requestId: randomUUID(), revision: state.revision, currentIndex: 19, answers: changeAnswers, flaggedQuestionIds: [paper[19].id] });
  assert.equal(updated.status, 200);
  changedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: firstQuestion.id }, select: { id: true, explanation: true } });
  await prisma.question.update({ where: { id: firstQuestion.id }, data: { explanation: "Changed after exam start" } });
  assert.equal((await api(path, a.cookie)).data.questions[0].questionText, firstQuestion.questionText);
  // Independent finish requests including replay after an ignored/lost response.
  const finishes = await Promise.all(Array.from({ length: 5 }, () => api(`${path}/finish`, a.cookie, "POST", {})));
  finishes.forEach((r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, "completed"); assert.deepEqual(r.data.result, finishes[0].data.result); });
  const result = finishes[0].data.result;
  assert.equal(result.points, 12); assert.equal(result.maxPoints, 20); assert.equal(result.skipped, 4);
  assert.equal(result.questions[0].explanation, firstQuestion.explanation);
  assert.equal(result.skills.length, 20); assert.equal(result.gaps.length, 8);
  assert.ok(result.recommendations.length > 0);
  assert.equal(await prisma.skillObservation.count({ where: { userId: a.id } }), beforeObservations + 16);
  assert.equal(await prisma.skillObservation.count({ where: { examSessionId: id } }), 16);
  assert.equal(await prisma.mistake.count({ where: { examSessionId: id } }), 4);
  const obs = await prisma.skillObservation.findMany({ where: { examSessionId: id } });
  assert.ok(obs.filter((o) => o.questionId === practiceQuestion.id).every((o) => o.usedHint && o.attemptNumber > 1));
  assert.equal(await prisma.userAttempt.count({ where: { userId: a.id } }), counters.attempts);
  assert.deepEqual(await prisma.userTopicProgress.findMany({ where: { userId: a.id } }), counters.topic);
  assert.deepEqual(await prisma.dailyGoal.findMany({ where: { userId: a.id } }), counters.goals);
  assert.deepEqual((await api(path, a.cookie)).data.result, result);
  const plan = await api("/api/learning-plan", a.cookie);
  assert.equal(plan.status, 200); assert.equal(plan.data.examId, id);
  assert.ok(plan.data.actions.some((action: any) => action.kind === "rule" && result.skills.some((s: any) => s.skillId === action.skillId)));
  assert.deepEqual((await api("/api/learning-plan", a.cookie)).data.actions, plan.data.actions);
  await prisma.question.update({ where: { id: changedQuestion.id }, data: { explanation: changedQuestion.explanation } }); changedQuestion = null;
  console.log("PASS: full 20-point paper, 5/10/5 quotas, server deadline, drafts/relogin, ownership, API key/help barriers, changed bank isolation, parallel 12/20 finish, 4 skips, result/mastery/plan persistence and unchanged practice counters.");
  // Replaying a start request can never create another exam, including after completion.
  const originalStart = { ...settings(), requestId: record.startRequestId };
  assert.equal((await api("/api/exams", a.cookie, "POST", originalStart)).data.id, id);
  assert.equal((await api("/api/exams", a.cookie, "POST", { ...originalStart, durationMinutes: 30 })).status, 409);
  const next = await api("/api/exams", a.cookie, "POST", settings()); assert.equal(next.status, 200);
  assert.notEqual(next.data.id, id); assert.equal((await api(path, a.cookie)).status, 403);
  assert.equal((await api(`${path}/finish`, a.cookie, "POST", {})).status, 403);
  await api(`/api/exams/${next.data.id}/finish`, a.cookie, "POST", {});
  // Expire on DB clock: a late save cannot add an answer or extend time; GET and finish race safely.
  const timed = await api("/api/exams", b.cookie, "POST", settings()); assert.equal(timed.status, 200);
  const timedPath = `/api/exams/${timed.data.id}`, timedRecord = await prisma.examSession.findUniqueOrThrow({ where: { id: timed.data.id } });
  const timedPaper = timedRecord.paper as unknown as PaperQuestion[];
  const timedSave = await api(timedPath, b.cookie, "PATCH", { requestId: randomUUID(), revision: 0, currentIndex: 1,
    answers: { [timedPaper[0].id]: timedPaper[0].correctIndex }, flaggedQuestionIds: [] });
  assert.equal(timedSave.status, 200);
  await prisma.$executeRaw`UPDATE "ExamSession" SET "startedAt" = clock_timestamp() - interval '41 minutes', "deadlineAt" = clock_timestamp() - interval '1 minute' WHERE "id" = ${timed.data.id}`;
  const late = await Promise.all([api(timedPath, b.cookie), api(`${timedPath}/finish`, b.cookie, "POST", {}),
    api(timedPath, b.cookie, "PATCH", { requestId: randomUUID(), revision: timedSave.data.revision, currentIndex: 2, answers: { [timedPaper[0].id]: timedPaper[0].correctIndex, [timedPaper[1].id]: timedPaper[1].correctIndex }, flaggedQuestionIds: [] })]);
  late.forEach((r) => { assert.equal(r.status, 200); assert.equal(r.data.status, "completed"); assert.equal(r.data.result.points, 1); assert.equal(r.data.result.completionReason, "timeout"); assert.equal(Object.keys(r.data.answers).length, 1); });
  assert.equal(await prisma.skillObservation.count({ where: { examSessionId: timed.data.id } }), 1);
  // Closed-browser expiration is finalized on list/read, with no client-dependent timer.
  const unattended = await api("/api/exams", c.cookie, "POST", settings()); assert.equal(unattended.status, 200);
  await prisma.$executeRaw`UPDATE "ExamSession" SET "startedAt" = clock_timestamp() - interval '41 minutes', "deadlineAt" = clock_timestamp() - interval '1 minute' WHERE "id" = ${unattended.data.id}`;
  const list = await api("/api/exams", c.cookie); assert.equal(list.data[0].status, "completed"); assert.equal(list.data[0].points, 0);
  assert.equal(await prisma.skillObservation.count({ where: { examSessionId: unattended.data.id } }), 0);
  const skipPlan = await api("/api/learning-plan", c.cookie);
  assert.equal(skipPlan.data.examId, unattended.data.id);
  assert.ok(skipPlan.data.actions.some((action: any) => action.kind === "rule" && action.reasons.includes("exam_gap")));
  assert.equal(await prisma.skillObservation.count({ where: { examSessionId: unattended.data.id } }), 0, "Planning a skipped skill must not fabricate mastery evidence");
  console.log("PASS: old report protected during next exam, replayed start does not extend time, expired browser-independent finish, rejected late answer, zero-point all-skip result.");
  // Deliberately invalidate a reviewed question: the real start endpoint must reject the paper.
  changedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: "exam_v1_ode_repeated_initial" }, select: { id: true, explanation: true } });
  await prisma.question.update({ where: { id: changedQuestion.id }, data: { explanation: "Invalidated review fixture" } });
  const unavailable = await api("/api/exams", c.cookie, "POST", settings());
  assert.equal(unavailable.status, 422); assert.match(unavailable.data.error, /16/);
  await prisma.question.update({ where: { id: changedQuestion.id }, data: { explanation: changedQuestion.explanation } }); changedQuestion = null;
  const sql = spawnSync("npx.cmd", ["prisma", "db", "execute", "--file", "prisma/updates/20261004_exam_mode.sql", "--schema", "prisma/schema.prisma"], { shell: true, encoding: "utf8", timeout: 60000 });
  assert.equal(sql.status, 0, sql.stderr); assert.deepEqual((await api(path, a.cookie)).data.result, result);
  console.log("PASS: live shortage refusal with missing point, additive migration replay preserves frozen papers and saved results.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (changedQuestion) await prisma.question.update({ where: { id: changedQuestion.id }, data: { explanation: changedQuestion.explanation } });
  for (const user of users) if (await prisma.user.findFirst({ where: { id: user.id, email: user.email } })) {
    await prisma.$transaction(async (tx) => {
      await tx.mistake.deleteMany({ where: { userId: user.id } });
      await tx.userStepAnswer.deleteMany({ where: { attempt: { userId: user.id } } });
      await tx.userAttempt.deleteMany({ where: { userId: user.id } });
      await tx.practiceSession.deleteMany({ where: { userId: user.id } });
      await tx.userTopicProgress.deleteMany({ where: { userId: user.id } });
      await tx.dailyGoal.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
  }
  await prisma.$disconnect();
});
