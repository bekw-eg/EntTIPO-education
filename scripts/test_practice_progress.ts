import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { calculateMasteryScore, calculateNextDifficulty } from "../lib/mastery";

const prisma = new PrismaClient();
const baseUrl = process.env.PROGRESS_TEST_BASE_URL || "http://localhost:3000";
const runId = `progress-test-${crypto.randomUUID()}`;
const accountIds: string[] = [];
const topicIds: string[] = [];

async function api(path: string, cookie?: string, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
  });
  return { status: response.status, data: await response.json(), response };
}

async function main() {
  assert.equal((await api("/api/attempts", undefined, "POST", {})).status, 401);
  assert.equal((await api("/api/sessions/unknown/hint", undefined, "POST", {})).status, 401);
  const fixture = await prisma.topic.create({ data: {
    name: runId, description: "Temporary progress fixture", order: 9999,
    questions: { create: [0, 1, 2].map((n) => ({
      title: `${runId}-${n}`, questionText: "Compute 1 + 1 and 2 + 2", difficulty: 1,
      correctAnswer: "4", answerType: "number", explanation: "2; 4",
      steps: { create: [
        { order: 1, type: "numeric_input", prompt: "1 + 1", expectedAnswer: "2", hint: "Add one to one" },
        { order: 2, type: "numeric_input", prompt: "2 + 2", expectedAnswer: "4" },
      ] },
    })) },
  }, include: { questions: { include: { steps: { orderBy: { order: "asc" } } } } } });
  topicIds.push(fixture.id);
  const otherTopic = await prisma.topic.create({ data: { name: `${runId}-other`, description: "Temporary fixture", order: 9999,
    questions: { create: { title: runId, questionText: "Other topic", difficulty: 1, correctAnswer: "2",
      answerType: "number", explanation: "2", steps: { create: { order: 1, type: "numeric_input", prompt: "1 + 1", expectedAnswer: "2" } } } },
  }, include: { questions: { include: { steps: true } } } });
  topicIds.push(otherTopic.id);
  const [q1, q2, q3] = fixture.questions;
  async function register(label: string) {
    const response = await api("/api/auth/register", undefined, "POST", {
      name: `${runId}-${label}`, email: `${runId}-${label}@example.test`, password: "test-password-123",
    });
    assert.equal(response.status, 200);
    const id = response.data.user.id as string;
    accountIds.push(id);
    return { id, cookie: (response.response.headers.get("set-cookie") || "").split(";")[0] };
  }
  const a = await register("A");
  const b = await register("B");
  // Directly create sessions with a known capacity; question selection is a separate concern.
  async function session(userId: string, totalCount = 2) {
    return prisma.practiceSession.create({ data: { userId, mode: "specific_topic", topicId: fixture.id, totalCount } });
  }
  const sa = await session(a.id);
  const sb = await session(b.id);
  const payload = (sessionId: string, question = q1, correct = false) => ({
    submissionId: crypto.randomUUID(), sessionId, questionId: question.id, usedHint: false, timeSpent: 10,
    stepAnswers: question.steps.map((step) => ({ stepId: step.id, answer: correct ? step.expectedAnswer : "9" })),
  });
  const post = (body: unknown, cookie = a.cookie) => api("/api/attempts", cookie, "POST", body);
  const initial = payload(sa.id);
  assert.equal((await post({ ...initial, submissionId: undefined })).status, 400);
  assert.equal((await post({ ...initial, stepAnswers: [initial.stepAnswers[0], initial.stepAnswers[0]] })).status, 400);
  assert.equal((await post({ ...initial, stepAnswers: [initial.stepAnswers[0]] })).status, 400);
  assert.equal((await post({ ...initial, stepAnswers: [initial.stepAnswers[0], { stepId: q2.steps[1].id, answer: "4" }] })).status, 400);
  assert.equal(await prisma.userAttempt.count({ where: { userId: a.id } }), 0);

  const copies = await Promise.all(Array.from({ length: 5 }, () => post(initial)));
  copies.forEach((copy) => { assert.equal(copy.status, 200); assert.deepEqual(copy.data, copies[0].data); });
  assert.equal(await prisma.userAttempt.count({ where: { userId: a.id } }), 1);
  assert.equal(await prisma.mistake.count({ where: { userId: a.id } }), 1);
  assert.equal(await prisma.userStepAnswer.count({ where: { attempt: { userId: a.id } } }), 2);
  assert.deepEqual(copies[0].data.sessionStats, { totalCount: 2, mode: "specific_topic",
    completedCount: 1, correctCount: 0, attemptCount: 1, correctAttemptCount: 0 });
  assert.equal((await post({ ...initial, timeSpent: 11 })).status, 409);
  assert.deepEqual((await post({ ...initial, stepAnswers: [...initial.stepAnswers].reverse() })).data, copies[0].data);

  const hintPath = `/api/sessions/${sa.id}/hint`;
  assert.equal((await api(hintPath, b.cookie, "POST", { questionId: q1.id })).status, 404);
  assert.equal((await api(hintPath, a.cookie, "POST", { questionId: otherTopic.questions[0].id })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await api(hintPath, a.cookie, "POST", { questionId: q1.id })).status, 200);
  assert.deepEqual((await prisma.practiceSession.findUniqueOrThrow({ where: { id: sa.id } })).hintedQuestionIds, [q1.id]);
  const next = await api(`/api/sessions/${sa.id}/next-question?questionIds=${q1.id}&index=0`, a.cookie);
  assert.equal(next.data.usedHint, true);
  const retry = await post(payload(sa.id, q1, true));
  assert.equal(retry.status, 200);
  assert.equal(retry.data.usedHint, true, "The server must remember a revealed hint despite usedHint=false");
  assert.equal(retry.data.attemptNumber, 2);
  assert.equal(retry.data.sessionStats.completedCount, 1);
  assert.equal(retry.data.sessionStats.correctCount, 1);
  assert.equal(retry.data.sessionStats.attemptCount, 2);
  const hintedProgress = await prisma.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: a.id, topicId: fixture.id } } });
  assert.equal(hintedProgress.masteryScore, 12, "Mastery includes hint and retry penalties");
  assert.equal(hintedProgress.totalAttempts, 2);
  const partial = payload(sa.id, q1);
  partial.stepAnswers[0].answer = "2";
  const afterFailure = await post(partial);
  assert.equal(afterFailure.data.isPartial, true);
  assert.equal(afterFailure.data.score, 50);
  assert.equal(afterFailure.data.sessionStats.correctCount, 1, "A later failure cannot erase a solved task");

  // Distinct concurrent submissions for one question each get an attempt number and one progress update.
  const parallel = await Promise.all([post(payload(sa.id, q2, true)), post(payload(sa.id, q2, true))]);
  parallel.forEach((result) => assert.equal(result.status, 200));
  assert.deepEqual(parallel.map((r) => r.data.attemptNumber).sort(), [1, 2]);
  const stats = await api(`/api/sessions/${sa.id}`, a.cookie);
  assert.equal(stats.data.completedCount, 2);
  assert.equal(stats.data.correctCount, 2);
  assert.equal(stats.data.attemptCount, 5);
  assert.equal(stats.data.correctAttemptCount, 3);
  assert.equal((await post(payload(sa.id, q3, true))).status, 409, "Session capacity limits distinct tasks");
  assert.equal((await post(payload(sa.id, otherTopic.questions[0] as typeof q1, true))).status, 400);
  const goals = await prisma.dailyGoal.findMany({ where: { userId: a.id } });
  assert.equal(goals.length, 1);
  assert.equal(goals[0].completedCount, 2);
  const dashboard = await api("/api/dashboard", a.cookie);
  assert.equal(dashboard.data.totalSolved, 2);
  assert.equal(dashboard.data.todaySolved, 2);
  assert.equal(dashboard.data.totalAttempts, 5);
  assert.equal(dashboard.data.overallAccuracy, 60);
  const statistics = await api("/api/statistics", a.cookie);
  assert.equal(statistics.data.totalSolved, 2);
  assert.equal(statistics.data.totalAttempts, 5);
  assert.equal(statistics.data.overallAccuracy, 60);
  assert.equal(statistics.data.dailyAccuracy[0].count, 2);
  assert.equal(statistics.data.dailyAccuracy[0].attemptCount, 5);

  // Replay must still return the original snapshot after completion and later progress updates.
  assert.equal((await api(`/api/sessions/${sa.id}`, a.cookie, "PATCH", { status: "completed" })).status, 200);
  await prisma.practiceSession.update({ where: { id: sa.id }, data: { completedCount: 99, correctCount: 99 } });
  const legacySession = (await api("/api/sessions", a.cookie)).data.find((s: { id: string }) => s.id === sa.id);
  assert.equal(legacySession.completedCount, 2, "Legacy session counters are derived from unique tasks");
  assert.equal(legacySession.correctCount, 2);
  assert.equal(legacySession.attemptCount, 5);
  assert.deepEqual((await post(initial)).data, copies[0].data);
  assert.equal((await post(payload(sa.id, q1, true))).status, 409);
  assert.equal((await api(hintPath, a.cookie, "POST", { questionId: q1.id })).status, 409);
  const sameIdOtherAccount = { ...initial, sessionId: sb.id };
  assert.equal((await post(sameIdOtherAccount, b.cookie)).status, 200, "Submission ID scope is the account");
  assert.equal(await prisma.userAttempt.count({ where: { userId: a.id } }), 5);

  // Exercise ordering through the HTTP route, with old failures followed by recent successes.
  const sc = await session(a.id, 3);
  const history = await prisma.userAttempt.findMany({ where: { userId: a.id }, orderBy: { createdAt: "asc" }, include: { question: true } });
  const toData = (attempt: typeof history[number]) => ({ isCorrect: attempt.isCorrect, isPartial: attempt.isPartial,
    score: attempt.score, usedHint: attempt.usedHint, difficulty: attempt.question.difficulty, attemptNumber: attempt.attemptNumber });
  const outcomes = history.map(toData);
  let expected = (await prisma.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: a.id, topicId: fixture.id } } }));
  let expectedScore = expected.masteryScore;
  let expectedLevel = expected.currentLevel;
  for (let i = 0; i < 5; i++) {
    const body = payload(sc.id, q3, true);
    const result = await post(body);
    assert.equal(result.status, 200);
    outcomes.push({ isCorrect: true, isPartial: false, score: 100, usedHint: false, difficulty: 1, attemptNumber: i + 1 });
    expectedScore = calculateMasteryScore(outcomes, expectedScore);
    expectedLevel = calculateNextDifficulty(expectedLevel, outcomes.slice(-10));
    const actual = await prisma.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: a.id, topicId: fixture.id } } });
    assert.equal(actual.masteryScore, expectedScore, `Chronological mastery after recent success ${i + 1}`);
    assert.equal(actual.currentLevel, expectedLevel, `Latest-five difficulty after recent success ${i + 1}`);
    assert.equal(actual.totalAttempts, 6 + i);
  }
  assert.equal((await api("/api/dashboard", a.cookie)).data.totalSolved, 3);
  assert.equal((await prisma.dailyGoal.findFirstOrThrow({ where: { userId: a.id } })).completedCount, 3);
  console.log("PASS: concurrent replay, UUID conflicts, exact step validation, task/attempt counts, hint persistence and completion replay");
  console.log("PASS: concurrent attempts preserve counters, daily goals use unique tasks, mastery and difficulty use recent outcomes");
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    const verified = await tx.user.findMany({ where: { id: { in: accountIds }, email: { startsWith: runId } }, select: { id: true } });
    const ids = verified.map((user) => user.id);
    const where = { userId: { in: ids } };
    await tx.mistake.deleteMany({ where });
    await tx.userStepAnswer.deleteMany({ where: { attempt: where } });
    await tx.userAttempt.deleteMany({ where });
    await tx.practiceSession.deleteMany({ where });
    await tx.userTopicProgress.deleteMany({ where });
    await tx.dailyGoal.deleteMany({ where });
    await tx.user.deleteMany({ where: { id: { in: ids }, email: { startsWith: runId } } });
    const topics = await tx.topic.findMany({ where: { id: { in: topicIds }, name: { startsWith: runId } }, select: { id: true } });
    const ownedIds = topics.map((topic) => topic.id);
    await tx.questionStep.deleteMany({ where: { question: { topicId: { in: ownedIds } } } });
    await tx.question.deleteMany({ where: { topicId: { in: ownedIds } } });
    await tx.topic.deleteMany({ where: { id: { in: ownedIds }, name: { startsWith: runId } } });
  });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { if (accountIds.length || topicIds.length) await cleanup(); }
  catch (error) { console.error("Test fixture cleanup failed:", error); process.exitCode = 1; }
  await prisma.$disconnect();
});
