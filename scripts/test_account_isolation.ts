import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testChoice } from "./choice_test_fixture";
import { choiceStepId } from "../lib/practiceChoice";

const prisma = new PrismaClient();
const baseUrl = process.env.AUTH_TEST_BASE_URL || "http://localhost:3000";
const runId = `auth-test-${crypto.randomUUID()}`;
const accountIds: string[] = [];
let topicId: string | undefined;

async function api(path: string, cookie?: string, method = "GET", body?: unknown,
  headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  assert.match(response.headers.get("cache-control") || "", /no-store/, `${method} ${path} must not be cached`);
  return { status: response.status, data, response };
}

async function main() {
  // Reject an unavailable server before creating any database fixtures.
  assert.equal((await api("/api/auth/me")).status, 401);
  const fixture = await prisma.topic.create({ data: {
    name: runId, description: "Temporary account isolation fixture", order: 9999,
    questions: { create: {
      title: runId, questionText: "1 + 1 = ?", difficulty: 1, correctAnswer: "2",
      answerType: "number", explanation: "1 + 1 = 2",
      steps: { create: { order: 1, type: "numeric_input", prompt: "1 + 1", expectedAnswer: "2" } },
    } },
  }, include: { questions: { include: { steps: true } } } });
  topicId = fixture.id;
  const question = fixture.questions[0];
  await prisma.question.update({ where: { id: question.id }, data: { practiceChoice: testChoice(question.id, false, undefined, 2) } });

  async function register(label: string) {
    const email = `${runId}-${label}@example.test`;
    const name = `${runId} ${label}`;
    const result = await api("/api/auth/register", undefined, "POST", { name, email, password: "test-password-123" });
    assert.equal(result.status, 200);
    accountIds.push(result.data.user.id);
    const setCookie = result.response.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    const cookie = setCookie.split(";")[0];
    assert.equal((await api("/api/auth/me", cookie)).data.user.id, result.data.user.id);
    return { id: result.data.user.id as string, cookie, email, name };
  }
  const a = await register("A");
  const b = await register("B");
  const login = await api("/api/auth/login", undefined, "POST", { email: a.email, password: "test-password-123" });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, a.id);
  const bearer = await api("/api/user", undefined, "GET", undefined, { Authorization: `Bearer ${login.data.token}` });
  assert.equal(bearer.data.id, a.id);
  const invalidRegistration = await api("/api/auth/register", undefined, "POST", { name: 123, email: "invalid", password: [] });
  assert.equal(invalidRegistration.status, 400);

  async function createSession(cookie: string) {
    const result = await api("/api/sessions", cookie, "POST", { mode: "specific_topic", topicId, totalCount: 1 });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.questionIds, [question.id]);
    return result.data.id as string;
  }
  const sessionA = await createSession(a.cookie);
  const sessionB = await createSession(b.cookie);
  async function answer(cookie: string, sessionId: string, value: string) {
    return api("/api/attempts", cookie, "POST", { submissionId: crypto.randomUUID(), sessionId, questionId: question.id,
      stepAnswers: [{ stepId: choiceStepId(question.id), answer: `${question.id}-${value === "2" ? 0 : 1}` }], timeSpent: 10 });
  }
  const attemptA = await answer(a.cookie, sessionA, "3");
  const attemptB = await answer(b.cookie, sessionB, "2");
  assert.equal(attemptA.status, 200);
  assert.equal(attemptB.status, 200);
  assert.equal(attemptA.data.isCorrect, false);
  assert.equal(attemptB.data.isCorrect, true);

  for (const account of [a, b]) {
    const me = await api("/api/user", account.cookie);
    assert.equal(me.data.id, account.id);
    assert.ok(!("password" in me.data));
    const users = await api("/api/auth/users", account.cookie);
    assert.deepEqual(users.data.users.map((user: any) => user.id), [account.id]);
    const sessions = await api("/api/sessions", account.cookie);
    assert.ok(sessions.data.length === 1 && sessions.data.every((session: any) => session.userId === account.id));
    const dashboard = await api("/api/dashboard", account.cookie);
    assert.equal(dashboard.data.totalSolved, 1);
    assert.equal(dashboard.data.overallAccuracy, account.id === a.id ? 0 : 100);
    assert.ok(dashboard.data.recentAttempts.every((attempt: any) => attempt.userId === account.id));
    const statistics = await api("/api/statistics", account.cookie);
    assert.equal(statistics.data.totalSolved, 1);
    assert.equal(statistics.data.overallAccuracy, account.id === a.id ? 0 : 100);
    assert.ok(statistics.data.topicProgress.every((progress: any) => progress.userId === account.id));
    const topics = await api("/api/topics", account.cookie);
    assert.ok(topics.data.every((topic: any) => topic.progress.every((progress: any) => progress.userId === account.id)));
    const topic = await api(`/api/topics/${topicId}`, account.cookie);
    assert.deepEqual(topic.data.progress.map((progress: any) => progress.userId), [account.id]);
    const progress = await api("/api/progress", account.cookie);
    assert.equal(progress.data.find((item: any) => item.topicId === topicId).masteryScore, account.id === a.id ? 0 : 30);
  }
  const mistakes = await api("/api/mistakes", a.cookie);
  assert.equal(mistakes.data.mistakes.length, 1);
  const mistakeId = mistakes.data.mistakes[0].id;
  assert.equal((await api("/api/mistakes", b.cookie)).data.mistakes.length, 0);
  assert.equal((await api(`/api/attempts?sessionId=${sessionA}`, a.cookie)).data.length, 1);
  assert.equal((await api(`/api/sessions/${sessionA}/next-question?questionIds=${question.id}&index=0`, a.cookie)).status, 200);

  for (const path of ["/api/user", "/api/auth/users", "/api/dashboard", "/api/statistics", "/api/progress",
    "/api/topics", `/api/topics/${topicId}`, "/api/mistakes", "/api/sessions", `/api/sessions/${sessionA}`,
    `/api/attempts?sessionId=${sessionA}`, `/api/sessions/${sessionA}/next-question?questionIds=${question.id}&index=0`]) {
    assert.equal((await api(path)).status, 401, path);
    assert.equal((await api(path, undefined, "GET", undefined, { "X-User-Id": a.id })).status, 401, `spoofed ${path}`);
  }
  assert.equal((await api("/api/user", b.cookie, "GET", undefined, { "X-User-Id": a.id })).data.id, b.id);
  assert.equal((await api("/api/user", `${a.cookie}broken`)).status, 401);
  assert.equal((await api("/api/sessions", undefined, "POST", {})).status, 401);
  assert.equal((await api("/api/attempts", undefined, "POST", {})).status, 401);
  assert.equal((await api("/api/ai/tutor", undefined, "POST", { action: "chat" })).status, 410);
  assert.equal((await api(`/api/mistakes/${mistakeId}`, undefined, "PATCH", { isReviewed: true })).status, 401);
  assert.equal((await api(`/api/sessions/${sessionA}`, b.cookie)).status, 404);
  assert.equal((await api(`/api/sessions/${sessionA}`, b.cookie, "PATCH", {})).status, 404);
  assert.equal((await api(`/api/attempts?sessionId=${sessionA}`, b.cookie)).status, 404);
  assert.equal((await api(`/api/sessions/${sessionA}/next-question?questionIds=${question.id}&index=0`, b.cookie)).status, 404);
  assert.equal((await answer(b.cookie, sessionA, "2")).status, 404);
  assert.equal((await api(`/api/mistakes/${mistakeId}`, b.cookie, "PATCH", { isReviewed: true })).status, 404);
  // The retired AI service refuses every request before an external provider call.
  assert.equal((await api("/api/ai/tutor", b.cookie, "POST", {
    action: "analyze_error", attemptId: attemptA.data.attemptId, questionId: question.id,
  })).status, 410);
  assert.equal((await prisma.practiceSession.findUniqueOrThrow({ where: { id: sessionA } })).status, "active");
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } })).isReviewed, false);
  assert.equal(await prisma.userAttempt.count({ where: { userId: { in: [a.id, b.id] } } }), 2);
  assert.equal((await api(`/api/mistakes/${mistakeId}`, a.cookie, "PATCH", { isReviewed: true })).status, 200);
  assert.equal((await api(`/api/sessions/${sessionA}`, a.cookie, "PATCH", {})).status, 200);

  const guestPage = await fetch(baseUrl, { redirect: "manual" });
  if (guestPage.status === 307) {
    assert.match(guestPage.headers.get("location") || "", /\/login$/);
  } else {
    // Next.js can start streaming the layout before emitting an RSC redirect.
    assert.equal(guestPage.status, 200);
    const html = await guestPage.text();
    assert.ok(html.includes("NEXT_REDIRECT;replace;/login;307;"));
    assert.ok(!html.includes(a.name) && !html.includes(b.name));
  }
  for (const account of [a, b]) {
    const html = await (await fetch(baseUrl, { headers: { Cookie: account.cookie } })).text();
    assert.ok(html.includes(account.name), "Server-rendered page must use the signed-in account");
    assert.ok(!html.includes(account.id === a.id ? b.name : a.name), "Server-rendered page must not contain another account");
  }
  assert.equal((await api("/api/auth/login", undefined, "POST", { email: "student@example.com", password: "password" })).status, 401);
  const demo = await api("/api/auth/demo", undefined, "POST");
  if (demo.status === 200) {
    const demoCookie = (demo.response.headers.get("set-cookie") || "").split(";")[0];
    const demoMe = await api("/api/auth/me", demoCookie);
    assert.equal(demoMe.data.user.isDemo, true);
    assert.ok(!accountIds.includes(demoMe.data.user.id));
  } else {
    assert.equal(demo.status, 404);
  }
  const logout = await api("/api/auth/logout", a.cookie, "POST");
  assert.equal(logout.status, 200);
  assert.match(logout.response.headers.get("set-cookie") || "", /Max-Age=0/i);
  assert.equal((await api("/api/auth/me")).status, 401);
  console.log("PASS: two accounts have isolated sessions, attempts, mistakes, dashboard, statistics and topic progress");
  console.log("PASS: foreign resource reads/writes, forged identity headers, server rendering, login/logout and demo separation");
}

async function cleanup() {
  // Delete only IDs created by this invocation, in relation order; never reset the DB.
  await prisma.$transaction(async (tx) => {
    const verifiedAccounts = await tx.user.findMany({
      where: { id: { in: accountIds }, email: { startsWith: runId } },
      select: { id: true },
    });
    const verifiedIds = verifiedAccounts.map((account) => account.id);
    const where = { userId: { in: verifiedIds } };
    await tx.mistake.deleteMany({ where });
    await tx.userStepAnswer.deleteMany({ where: { attempt: where } });
    await tx.userAttempt.deleteMany({ where });
    await tx.practiceSession.deleteMany({ where });
    await tx.userTopicProgress.deleteMany({ where });
    await tx.dailyGoal.deleteMany({ where });
    await tx.user.deleteMany({ where: { id: { in: verifiedIds }, email: { startsWith: runId } } });
    const ownedTopic = topicId && await tx.topic.findFirst({ where: { id: topicId, name: runId } });
    if (ownedTopic) {
      await tx.questionStep.deleteMany({ where: { question: { topicId: ownedTopic.id } } });
      await tx.question.deleteMany({ where: { topicId: ownedTopic.id } });
      await tx.topic.deleteMany({ where: { id: ownedTopic.id, name: runId } });
    }
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    try { if (accountIds.length || topicId) await cleanup(); }
    catch (error) { console.error("Could not clean up test fixtures:", error); process.exitCode = 1; }
    await prisma.$disconnect();
  });
