import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.SESSION_TEST_BASE_URL || "http://localhost:3000";
const runId = `session-test-${crypto.randomUUID()}`;
const accountIds: string[] = [];
let topicId: string | undefined;
async function api(path: string, cookie?: string, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
  });
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  return { status: response.status, data: await response.json(), response };
}
function noAnswerKey(question: any) {
  assert.ok(question && !("correctAnswer" in question) && !("explanation" in question));
  question.steps.forEach((step: any) => {
    assert.ok(!("expectedAnswer" in step));
    step.options.forEach((option: any) => assert.ok(!("isCorrect" in option)));
  });
}
async function main() {
  assert.equal((await api("/api/auth/me")).status, 401);
  const fixture = await prisma.topic.create({ data: { name: runId, description: "Temporary persistence fixture", order: 9999,
    questions: { create: [0, 1, 2].map((n) => ({ title: `${runId}-${n}`, questionText: "Compute 3 + 4", difficulty: 1,
      correctAnswer: "7", answerType: "number", explanation: "Three plus four is seven",
      steps: { create: [
        { order: 1, type: "numeric_input", prompt: "Compute 3 + 4", expectedAnswer: "7", hint: "Add four to three" },
        { order: 2, type: "multiple_choice", prompt: "Select the result", expectedAnswer: "7",
          options: { create: [{ text: "7", isCorrect: true, order: 0 }, { text: "8", isCorrect: false, order: 1 }] } },
      ] },
    })) },
  }, include: { questions: { include: { steps: { orderBy: { order: "asc" }, include: { options: true } } } } } });
  topicId = fixture.id;
  async function register(label: string) {
    const result = await api("/api/auth/register", undefined, "POST", { name: `${runId}-${label}`,
      email: `${runId}-${label}@example.test`, password: "test-password-123" });
    assert.equal(result.status, 200);
    accountIds.push(result.data.user.id);
    return { id: result.data.user.id as string, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
  }
  const a = await register("A"), b = await register("B");
  const created = await api("/api/sessions", a.cookie, "POST", { mode: "specific_topic", topicId, totalCount: 2 });
  assert.equal(created.status, 200);
  const path = `/api/sessions/${created.data.id}`;
  const ids = created.data.questionIds as string[];
  assert.equal(ids.length, 2);
  assert.deepEqual((await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.data.id } })).questionIds, ids);
  let state = (await api(path, a.cookie)).data;
  noAnswerKey(state.question);
  assert.equal(state.result, null);
  assert.equal(state.currentIndex, 0);
  assert.deepEqual(state.draftAnswers, {});
  assert.ok(!("hint" in state.question.steps[0]), "Hints are returned only when explicitly opened");
  const q1 = fixture.questions.find((question) => question.id === ids[0])!;
  const q2 = fixture.questions.find((question) => question.id === ids[1])!;
  const outside = fixture.questions.find((question) => !ids.includes(question.id))!;
  const forged = await api(`${path}/next-question?questionIds=${outside.id}&index=0`, a.cookie);
  assert.equal(forged.data.id, q1.id, "A URL cannot change the server's question selection");
  noAnswerKey(forged.data);
  assert.equal((await api(`${path}/next-question?index=-1`, a.cookie)).status, 400);
  assert.equal((await api(`${path}/next-question?index=2`, a.cookie)).status, 404);
  assert.equal((await api(`${path}/state`, undefined, "PATCH", {})).status, 401);
  assert.equal((await api(`${path}/state`, b.cookie, "PATCH", { action: "next", revision: 0 })).status, 404);
  assert.equal((await api(path, b.cookie)).status, 404);
  assert.equal((await api(`${path}/state`, a.cookie, "PATCH", { action: "next", revision: state.revision })).status, 409);

  const answers = { [q1.steps[0].id]: "3 + (", [q1.steps[1].id]: "" };
  const save = (revision: number, values: Record<string, string>) => api(`${path}/state`, a.cookie, "PATCH", {
    action: "save", currentIndex: 0, revision, answers: values,
  });
  assert.equal((await save(state.revision, { foreign: "7" })).status, 400);
  const saved = await save(state.revision, answers);
  assert.equal(saved.status, 200);
  assert.equal((await save(state.revision, { [q1.steps[0].id]: "stale" })).status, 409);
  state = (await api(path, a.cookie)).data;
  assert.deepEqual(state.draftAnswers, answers, "A fresh request restores incomplete answers exactly");
  assert.deepEqual(state.questionIds, ids);
  const parallel = await Promise.all([save(state.revision, { [q1.steps[0].id]: "first" }), save(state.revision, { [q1.steps[0].id]: "second" })]);
  assert.deepEqual(parallel.map((result) => result.status).sort(), [200, 409]);
  state = (await api(path, a.cookie)).data;
  assert.ok(["first", "second"].includes(state.draftAnswers[q1.steps[0].id]));
  const hint = await api(`${path}/hint`, a.cookie, "POST", { questionId: q1.id });
  assert.equal(hint.data.hints[q1.steps[0].id], q1.steps[0].hint);
  assert.equal((await api(`${path}/hint`, a.cookie, "POST", { questionId: outside.id })).status, 400);
  assert.equal((await api(path, a.cookie)).data.question.usedHint, true);
  const payload = (question = q1, correct = false) => ({ submissionId: crypto.randomUUID(), sessionId: created.data.id,
    questionId: question.id, usedHint: false, timeSpent: 10,
    stepAnswers: question.steps.map((step) => ({ stepId: step.id, answer: correct ? "7" : "8" })),
  });
  assert.equal((await api("/api/attempts", a.cookie, "POST", payload(outside))).status, 400);
  const wrong = await api("/api/attempts", a.cookie, "POST", payload());
  assert.equal(wrong.status, 200);
  assert.equal(wrong.data.correctAnswer, "7");
  assert.ok(wrong.data.stepResults.every((step: any) => step.expectedAnswer === "7"));
  state = (await api(path, a.cookie)).data;
  assert.deepEqual(state.result, wrong.data, "The checked result survives closing and reopening the page");
  noAnswerKey(state.question);
  assert.equal((await save(state.revision, answers)).status, 409, "Autosaving cannot erase a checked result");
  const retry = await api(`${path}/state`, a.cookie, "PATCH", { action: "retry", revision: state.revision });
  assert.equal(retry.status, 200);
  state = retry.data;
  assert.equal(state.result, null);
  assert.deepEqual(state.draftAnswers, {});
  assert.equal(state.attemptCount, 1);
  const correctPayload = payload(q1, true);
  const correct = await api("/api/attempts", a.cookie, "POST", correctPayload);
  assert.equal(correct.data.usedHint, true);
  state = (await api(path, a.cookie)).data;
  assert.equal(state.result.isCorrect, true);
  const next = await api(`${path}/state`, a.cookie, "PATCH", { action: "next", revision: state.revision });
  assert.equal(next.status, 200);
  state = (await api(path, a.cookie)).data;
  assert.equal(state.currentIndex, 1);
  assert.equal(state.question.id, q2.id);
  assert.equal(state.result, null);
  assert.deepEqual(state.draftAnswers, {});
  noAnswerKey(state.question);
  const revision = state.revision;
  assert.deepEqual((await api("/api/attempts", a.cookie, "POST", correctPayload)).data, correct.data);
  assert.equal((await api(path, a.cookie)).data.revision, revision, "An old submission replay cannot move the cursor backwards");
  const lastPayload = payload(q2, true);
  const copies = await Promise.all([api("/api/attempts", a.cookie, "POST", lastPayload), api("/api/attempts", a.cookie, "POST", lastPayload)]);
  assert.equal(copies[0].status, 200);
  assert.deepEqual(copies[0].data, copies[1].data);
  state = (await api(path, a.cookie)).data;
  assert.deepEqual(state.result, copies[0].data);
  const done = await api(`${path}/state`, a.cookie, "PATCH", { action: "next", revision: state.revision });
  assert.equal(done.status, 200);
  state = (await api(path, a.cookie)).data;
  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 2);
  assert.equal(state.attemptCount, 3);
  assert.deepEqual(state.questionIds, ids);
  assert.ok(!(await api("/api/sessions?status=active", a.cookie)).data.some((session: any) => session.id === created.data.id));
  assert.equal((await save(state.revision, answers)).status, 409);
  assert.deepEqual((await api("/api/attempts", a.cookie, "POST", lastPayload)).data, copies[0].data);

  const legacy = await prisma.practiceSession.create({ data: {
    userId: a.id, mode: "specific_topic", topicId, totalCount: 2,
    attempts: { create: { userId: a.id, questionId: q1.id, isCorrect: true,
      stepAnswers: { create: q1.steps.map((step) => ({ stepId: step.id, answer: "7", isCorrect: true })) } } },
  } });
  const before = await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.data.id } });
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file",
    "prisma/updates/20261004_persistent_practice.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
  assert.deepEqual(await prisma.practiceSession.findUniqueOrThrow({ where: { id: created.data.id } }), before,
    "Reapplying the migration must not reset saved state");
  const repaired = await prisma.practiceSession.findUniqueOrThrow({ where: { id: legacy.id } });
  assert.equal(repaired.questionIds[0], q1.id);
  assert.equal(repaired.currentIndex, 1);
  assert.equal(await prisma.userAttempt.count({ where: { sessionId: legacy.id } }), 1);
  console.log("PASS: canonical question lists, incomplete drafts, cursor/result/retry recovery, account isolation and conflict rejection");
  console.log("PASS: answer keys follow grading, lost submission replay, completion persistence and non-destructive migration");
}
async function cleanup() {
  await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({ where: { id: { in: accountIds }, email: { startsWith: runId } }, select: { id: true } });
    const where = { userId: { in: users.map((user) => user.id) } };
    await tx.mistake.deleteMany({ where });
    await tx.userStepAnswer.deleteMany({ where: { attempt: where } });
    await tx.userAttempt.deleteMany({ where });
    await tx.practiceSession.deleteMany({ where });
    await tx.userTopicProgress.deleteMany({ where });
    await tx.dailyGoal.deleteMany({ where });
    await tx.user.deleteMany({ where: { id: { in: where.userId.in }, email: { startsWith: runId } } });
    if (topicId && await tx.topic.findFirst({ where: { id: topicId, name: runId } })) {
      await tx.questionOption.deleteMany({ where: { step: { question: { topicId } } } });
      await tx.questionStep.deleteMany({ where: { question: { topicId } } });
      await tx.question.deleteMany({ where: { topicId } });
      await tx.topic.deleteMany({ where: { id: topicId, name: runId } });
    }
  });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { if (accountIds.length || topicId) await cleanup(); }
  catch (error) { console.error("Could not clean up persistence fixtures:", error); process.exitCode = 1; }
  await prisma.$disconnect();
});
