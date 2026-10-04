import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { getDailyLearningPlan } from "../lib/dailyLearningPlan";
import { recordQuestionHelp } from "../lib/practiceStorage";
import { addDays, localDay } from "../lib/learningPolicy";
import { seedSkills } from "../prisma/skillSeed";

const prisma = new PrismaClient(), users: string[] = [];
const base = process.env.PLAN_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const runId = `plan-test-${randomUUID()}`;
let fixtureTopicId: string | undefined, fixtureSkillId: string | undefined;
type Account = { id: string; cookie: string; email: string };
async function api(path: string, cookie?: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return { status: response.status, data: await response.json(), response };
}
async function register(label: string): Promise<Account> {
  const email = `${runId}-${label}@example.test`;
  const result = await api("/api/auth/register", undefined, "POST", { name: label, email, password: "test-password-123" });
  assert.equal(result.status, 200); users.push(result.data.user.id);
  return { id: result.data.user.id, cookie: result.response.headers.get("set-cookie")!.split(";")[0], email };
}
async function practice(account: Account, questionId: string, skillId = "power_properties") {
  const result = await api("/api/sessions", account.cookie, "POST", { mode: "mixed", totalCount: 1, skillId, questionId });
  assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data.id as string;
}
async function payload(sessionId: string, questionId: string, correct = true) {
  const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { steps: { include: { options: true } } } });
  return { sessionId, questionId, submissionId: randomUUID(), usedHint: false, stepAnswers: q.steps.map((s) => ({
    stepId: s.id, answer: correct ? s.type === "multiple_choice" ? s.options.find((o) => o.isCorrect)!.id : s.expectedAnswer : "999999",
  })) };
}
async function answer(account: Account, sessionId: string, questionId: string, correct = true, copies = 1) {
  const body = await payload(sessionId, questionId, correct);
  const responses = await Promise.all(Array.from({ length: copies }, () => api("/api/attempts", account.cookie, "POST", body)));
  responses.forEach((r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); assert.deepEqual(r.data, responses[0].data); });
  return { result: responses[0].data, body };
}
async function finishDiagnostic(account: Account, wrongPower = false, restartFromId?: string) {
  const started = await api("/api/diagnostics", account.cookie, "POST", restartFromId ? { restartFromId } : undefined); assert.equal(started.status, 200);
  for (let i = 0; i < 9; i++) {
    const state = (await api(`/api/diagnostics/${started.data.id}`, account.cookie)).data;
    const body = await payload("", state.question.id, !(wrongPower && state.question.id.startsWith("diag_power")));
    const result = await api(`/api/diagnostics/${started.data.id}/answers`, account.cookie, "POST", {
      submissionId: body.submissionId, questionId: body.questionId, stepAnswers: body.stepAnswers, revision: state.revision,
    }); assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  return started.data.id as string;
}
function sessionFromHref(href: string) { return href.split("/").at(-1)!; }
async function main() {
  assert.equal((await api("/api/learning-plan")).status, 401);
  const a = await register("A"), b = await register("B"), c = await register("C"), d = await register("D");
  const starts = await Promise.all(Array.from({ length: 4 }, () => api("/api/learning-plan", a.cookie)));
  starts.forEach((r) => { assert.equal(r.status, 200); assert.equal(r.data.id, starts[0].data.id); });
  assert.equal(starts[0].data.actions.length, 1); assert.equal(starts[0].data.actions[0].kind, "diagnostic");
  assert.equal(starts[0].data.timeZone, "Asia/Qyzylorda");
  assert.equal(await prisma.dailyLearningPlan.count({ where: { userId: a.id } }), 1);
  const bPlan = (await api("/api/learning-plan", b.cookie)).data;
  assert.notEqual(bPlan.id, starts[0].data.id);
  assert.equal((await api("/api/learning-plan", b.cookie, "POST", { action: "start", actionId: starts[0].data.actions[0].id })).status, 404);
  const originalSession = await practice(a, "practice_power_product");
  await answer(a, originalSession, "practice_power_product", false);
  const original = await prisma.mistake.findFirstOrThrow({ where: { userId: a.id, questionId: "practice_power_product" } });
  await finishDiagnostic(a, true);
  const plan = (await api("/api/learning-plan", a.cookie)).data;
  const rule = plan.actions.find((x: any) => x.kind === "rule"), work = plan.actions.find((x: any) => x.kind === "practice"), checkAction = plan.actions.find((x: any) => x.kind === "check");
  assert.equal(rule.skillId, "power_properties"); assert.equal(work.questionIds.length, 3);
  assert.equal(checkAction.mistakeId, original.id);
  assert.ok(!work.questionIds.includes(checkAction.questionIds[0]));
  assert.ok(rule.reasons.includes("diagnostic_gap"));
  const unchanged = (await api("/api/learning-plan", a.cookie)).data;
  assert.deepEqual(unchanged.actions, plan.actions);
  assert.equal((await api("/api/learning-plan", b.cookie, "POST", { action: "complete_rule", actionId: rule.id })).status, 404);
  assert.equal((await api("/api/learning-plan", a.cookie, "POST", { action: "complete_rule", actionId: checkAction.id })).status, 400);
  assert.equal((await api("/api/learning-plan", a.cookie, "POST", { action: "complete_rule", actionId: rule.id })).status, 200);
  const ruleBefore = await prisma.learningPlanAction.findUniqueOrThrow({ where: { id: rule.id } });
  await api("/api/learning-plan", a.cookie, "POST", { action: "complete_rule", actionId: rule.id });
  assert.deepEqual(await prisma.learningPlanAction.findUnique({ where: { id: rule.id } }), ruleBefore);
  const sessions = await Promise.all(Array.from({ length: 4 }, () => api("/api/learning-plan", a.cookie, "POST", { action: "start", actionId: work.id })));
  sessions.forEach((r) => { assert.equal(r.status, 200); assert.equal(r.data.href, sessions[0].data.href); });
  const workSession = sessionFromHref(sessions[0].data.href);
  assert.equal(await prisma.practiceSession.count({ where: { id: workSession, userId: a.id } }), 1);
  const statePath = `/api/sessions/${workSession}`;
  const workState = (await api(statePath, a.cookie)).data;
  const draft = { [workState.question.steps[0].id]: "x^(" };
  assert.equal((await api(`${statePath}/state`, a.cookie, "PATCH", { action: "save", currentIndex: 0, revision: workState.revision, answers: draft })).status, 200);
  await api("/api/auth/logout", a.cookie, "POST");
  const login = await api("/api/auth/login", undefined, "POST", { email: a.email, password: "test-password-123" });
  assert.equal(login.status, 200); a.cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  assert.deepEqual((await api(statePath, a.cookie)).data.draftAnswers, draft);
  assert.equal((await api("/api/learning-plan", a.cookie)).data.actions.find((x: any) => x.id === work.id).sessionId, workSession);
  assert.equal((await api(statePath, b.cookie)).status, 404);
  assert.equal((await api(statePath, a.cookie, "PATCH")).status, 200);
  assert.equal((await api("/api/learning-plan", a.cookie)).data.actions.find((x: any) => x.id === work.id).completedAt, null, "Ending a session does not fabricate completed practice");
  const resumed = await api("/api/learning-plan", a.cookie, "POST", { action: "start", actionId: work.id });
  assert.equal(resumed.data.href, sessions[0].data.href);
  assert.equal((await api(statePath, a.cookie)).data.status, "active");
  for (const id of workState.questionIds) await answer(a, workSession, id);
  assert.ok((await api("/api/learning-plan", a.cookie)).data.actions.find((x: any) => x.id === work.id).completedAt);

  const mistakePath = `/api/mistakes/${original.id}`;
  assert.equal((await api(mistakePath, b.cookie, "PATCH", { isReviewed: true })).status, 404);
  assert.equal((await api(`${mistakePath}/check`, b.cookie, "POST")).status, 404);
  assert.equal((await api(mistakePath, a.cookie, "PATCH", { isReviewed: true, confirmedAt: new Date().toISOString() })).status, 400);
  assert.equal((await api(mistakePath, a.cookie, "PATCH", { isReviewed: true })).status, 200);
  const viewed = await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } });
  assert.equal(viewed.confirmedAt, null); assert.ok(viewed.reviewedAt);
  await answer(a, originalSession, original.questionId, true);
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } })).confirmedAt, null);
  const wrongOther = await prisma.mistake.create({ data: { userId: a.id, questionId: "practice_power_nested", topicId: "t1", skillId: "power_properties", errorType: "algebra_error" } });
  const checks = await Promise.all(Array.from({ length: 4 }, () => api("/api/learning-plan", a.cookie, "POST", { action: "start", actionId: checkAction.id })));
  checks.forEach((r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.href, checks[0].data.href); });
  const checkSession = sessionFromHref(checks[0].data.href);
  assert.equal((await api(`${mistakePath}/check`, a.cookie, "POST")).data.href, checks[0].data.href);
  const check = await prisma.learningCheck.findUniqueOrThrow({ where: { sessionId: checkSession } });
  assert.notEqual(check.questionId, original.questionId);
  assert.ok(await prisma.questionSkill.findUnique({ where: { questionId_skillId: { questionId: check.questionId, skillId: "power_properties" } } }));
  assert.equal((await api(`/api/sessions/${checkSession}/hint`, a.cookie, "POST", { questionId: check.questionId })).status, 200);
  const helped = await answer(a, checkSession, check.questionId, true, 4);
  assert.equal(helped.result.usedHint, true); assert.equal(helped.result.learningCheck.status, "failed");
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } })).confirmedAt, null);
  await answer(a, checkSession, check.questionId, true);
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } })).confirmedAt, null, "Retrying an exposed key cannot confirm");
  const fresh = await api(`${mistakePath}/check`, a.cookie, "POST");
  assert.equal(fresh.status, 200); const freshSession = sessionFromHref(fresh.data.href);
  assert.notEqual(freshSession, checkSession);
  const freshCheck = await prisma.learningCheck.findUniqueOrThrow({ where: { sessionId: freshSession } });
  assert.notEqual(freshCheck.questionId, check.questionId);
  const proof = await answer(a, freshSession, freshCheck.questionId, true, 4);
  assert.equal(proof.result.learningCheck.status, "passed");
  const confirmed = await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } });
  assert.ok(confirmed.confirmedAt); assert.equal(confirmed.confirmationAttemptId, proof.result.attemptId);
  assert.equal((await prisma.learningCheck.findUniqueOrThrow({ where: { sessionId: freshSession } })).attemptId, proof.result.attemptId);
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: wrongOther.id } })).confirmedAt, null);
  const schedule = await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } });
  assert.equal(schedule.dueDay, addDays(localDay(new Date(), "Asia/Qyzylorda"), 1));
  assert.equal(await prisma.skillReview.count({ where: { userId: a.id, skillId: "power_properties" } }), 1);
  assert.deepEqual((await api("/api/attempts", a.cookie, "POST", proof.body)).data, proof.result);
  assert.deepEqual(await prisma.skillReview.findUnique({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } }), schedule);
  assert.equal((await api("/api/mistakes?state=confirmed", b.cookie)).data.mistakes.length, 0);
  assert.ok((await api("/api/mistakes?state=confirmed", a.cookie)).data.mistakes.some((m: any) => m.id === original.id));
  const completedAction = (await api("/api/learning-plan", a.cookie)).data.actions.find((x: any) => x.id === checkAction.id);
  assert.ok(completedAction.completedAt); assert.equal(completedAction.sessionId, freshSession, "A check passed from the errors screen completes the same daily action");
  console.log("PASS: isolated stable daily plans, diagnostic selection, concrete rules, saved sessions/drafts, relogin and today's completions");
  console.log("PASS: viewing/same-task retries/help cannot confirm; another independent linked answer confirms only its source mistake; request replay is idempotent");

  for (const [index, interval] of [[1, 3], [2, 7], [3, 14]] as const) {
    await prisma.skillReview.update({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } }, data: { dueDay: localDay(new Date(), "Asia/Qyzylorda") } });
    const before = await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } });
    const starts = await Promise.all(Array.from({ length: 3 }, () => api(`${mistakePath}/check`, a.cookie, "POST")));
    starts.forEach((r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.href, starts[0].data.href); });
    const s = sessionFromHref(starts[0].data.href), check = await prisma.learningCheck.findUniqueOrThrow({ where: { sessionId: s } });
    const result = await answer(a, s, check.questionId, true, 3);
    assert.equal(result.result.learningCheck.status, "passed");
    const after = await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } });
    assert.equal(after.intervalIndex, index); assert.equal(after.dueDay, addDays(localDay(new Date(), "Asia/Qyzylorda"), interval));
    assert.equal(after.version, before.version + 1);
  }
  // Assistance is persistent even without a session, and repeated requests add no evidence twice.
  const helpQuestion = (await prisma.question.findFirstOrThrow({ where: { purpose: "verification", skills: { some: { skillId: "power_properties" } },
    questionHelp: { none: { userId: a.id } }, attempts: { none: { userId: a.id } } }, orderBy: { id: "asc" } })).id;
  const beforeHelpCount = await prisma.questionHelp.count({ where: { userId: a.id } });
  await recordQuestionHelp(a.id, helpQuestion); const reset = await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } });
  await recordQuestionHelp(a.id, helpQuestion);
  assert.equal(reset.intervalIndex, 0); assert.equal(reset.dueDay, addDays(localDay(new Date(), "Asia/Qyzylorda"), 1));
  assert.equal(await prisma.questionHelp.count({ where: { userId: a.id } }), beforeHelpCount + 1);
  assert.deepEqual(await prisma.skillReview.findUnique({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } }), reset);
  await answer(a, originalSession, original.questionId, false, 3);
  assert.equal((await prisma.skillReview.findUniqueOrThrow({ where: { userId_skillId: { userId: a.id, skillId: "power_properties" } } })).intervalIndex, 0);
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: original.id } })).confirmationAttemptId, proof.result.attemptId);
  console.log("PASS: successful reviews advance 1/3/7/14 intervals once; errors and assistance reset to one day without erasing past confirmation");

  const aDiagnostic = await prisma.diagnosticSession.findFirstOrThrow({ where: { userId: a.id }, orderBy: { startedAt: "desc" } });
  await finishDiagnostic(a, false, aDiagnostic.id);
  assert.equal((await api("/api/learning-plan", a.cookie)).data.canRecalculate, false);
  assert.equal((await api("/api/learning-plan", a.cookie, "POST", { action: "recalculate" })).status, 409);
  assert.equal((await api("/api/learning-plan", a.cookie)).data.actions.find((x: any) => x.id === rule.id).status, "completed");
  const bDiagnostic = await finishDiagnostic(b, true);
  const bInitial = (await api("/api/learning-plan", b.cookie)).data;
  const retakes = await Promise.all(Array.from({ length: 4 }, () => api("/api/diagnostics", b.cookie, "POST", { restartFromId: bDiagnostic })));
  retakes.forEach((r) => { assert.equal(r.status, 200); assert.equal(r.data.id, retakes[0].data.id); });
  assert.equal((await api("/api/diagnostics", a.cookie, "POST", { restartFromId: bDiagnostic })).status, 404);
  await finishDiagnostic(b, false, bDiagnostic);
  assert.equal((await api("/api/diagnostics", b.cookie, "POST", { restartFromId: bDiagnostic })).data.id, retakes[0].data.id);
  assert.equal((await api("/api/learning-plan", b.cookie)).data.canRecalculate, true);
  const recalculated = await api("/api/learning-plan", b.cookie, "POST", { action: "recalculate" });
  assert.equal(recalculated.status, 200); assert.equal(recalculated.data.diagnosticId, retakes[0].data.id);
  assert.equal(await prisma.learningPlanAction.count({ where: { planId: bInitial.id, status: "superseded" } }), 3);
  assert.equal((await api("/api/learning-plan", b.cookie, "POST", { action: "start", actionId: bInitial.actions.find((x: any) => x.kind === "rule").id })).status, 404);
  assert.ok((await prisma.skillObservation.findMany({ where: { userId: b.id, diagnosticAnswer: { sessionId: retakes[0].data.id } } })).every((o) => o.attemptNumber > 1));
  console.log("PASS: repeated diagnostic start is idempotent; unstarted plan can recalculate; started work survives new results and repeat observations are discounted");

  // Account C: calendar-day boundaries and carrying a started session with drafts.
  await finishDiagnostic(c);
  const beforeMidnight = new Date("2026-10-10T18:59:59.999Z"), afterMidnight = new Date("2026-10-10T19:00:00Z");
  const yesterday = await getDailyLearningPlan(c.id, beforeMidnight);
  assert.ok(yesterday.actions.find((x) => x.kind === "rule")!.reasons.includes("maintenance"));
  const cRule = yesterday.actions.find((x) => x.kind === "rule")!, cWork = yesterday.actions.find((x) => x.kind === "practice")!;
  await api("/api/learning-plan", c.cookie, "POST", { action: "complete_rule", actionId: cRule.id });
  const training = await api("/api/learning-plan", c.cookie, "POST", { action: "start", actionId: cWork.id });
  const cs = sessionFromHref(training.data.href), cursor = (await api(`/api/sessions/${cs}`, c.cookie)).data;
  const savedDraft = { [cursor.question.steps[0].id]: "unfinished" };
  await api(`/api/sessions/${cs}/state`, c.cookie, "PATCH", { action: "save", currentIndex: 0, revision: cursor.revision, answers: savedDraft });
  assert.equal((await getDailyLearningPlan(c.id, beforeMidnight)).id, yesterday.id);
  const tomorrow = await getDailyLearningPlan(c.id, afterMidnight);
  assert.notEqual(tomorrow.id, yesterday.id); assert.equal(tomorrow.day, "2026-10-11");
  assert.equal(tomorrow.actions.find((x) => x.kind === "practice")!.sessionId, cs);
  assert.ok(tomorrow.actions.every((x) => x.kind !== "rule"));
  assert.deepEqual((await api(`/api/sessions/${cs}`, c.cookie)).data.draftAnswers, savedDraft);
  assert.equal((await prisma.dailyLearningPlan.findUniqueOrThrow({ where: { id: yesterday.id } })).status, "archived");
  assert.ok((await prisma.learningPlanAction.findUniqueOrThrow({ where: { id: cRule.id } })).completedAt);
  // An unstarted previous plan is archived and gets new action IDs.
  const bYesterday = await getDailyLearningPlan(b.id, beforeMidnight), bTomorrow = await getDailyLearningPlan(b.id, afterMidnight);
  assert.notEqual(bYesterday.actions[0].id, bTomorrow.actions[0].id);
  assert.equal((await api("/api/user", b.cookie, "PATCH", { timeZone: "Wrong/Zone" })).status, 400);
  assert.equal((await api("/api/user", b.cookie, "PATCH", { timeZone: "Pacific/Honolulu" })).status, 200);
  assert.equal((await getDailyLearningPlan(b.id, new Date("2026-10-12T08:00:00Z"))).day, "2026-10-11");
  for (const id of ["practice_power_product", "practice_power_nested", "practice_power_quotient"]) await answer(d, await practice(d, id), id, false);
  const doneToday = (await api("/api/learning-plan", d.cookie)).data;
  assert.equal(doneToday.actions.find((x: any) => x.kind === "practice").skillId, "power_properties");
  assert.ok(doneToday.actions.find((x: any) => x.kind === "practice").completedAt, "Today's existing work is credited");
  console.log("PASS: learner midnight/alternate zone, archived history, carried session/draft, no reset of completed actions and credit for today's earlier work");

  // No candidate: explicit skill, but only the original or unsuitable difficulty exists.
  fixtureTopicId = `${runId}-topic`; fixtureSkillId = `${runId}-skill`;
  await prisma.topic.create({ data: { id: fixtureTopicId, name: runId, description: "test", order: 100 } });
  await prisma.skill.create({ data: { id: fixtureSkillId, topicId: fixtureTopicId, nameRu: "test", nameKk: "test", ruleRu: "test", ruleKk: "test", explanationRu: "test", explanationKk: "test" } });
  for (const [suffix, difficulty] of [["original", 1], ["hard", 5]] as const) await prisma.question.create({ data: {
    id: `${runId}-${suffix}`, topicId: fixtureTopicId, title: "test", questionText: "test", correctAnswer: "2", answerType: "number", explanation: "test", difficulty,
    skills: { create: { skillId: fixtureSkillId } }, steps: { create: { order: 1, type: "numeric_input", prompt: "test", expectedAnswer: "2", skills: { create: { skillId: fixtureSkillId } } } },
  } });
  const unavailable = await prisma.mistake.create({ data: { userId: b.id, questionId: `${runId}-original`, topicId: fixtureTopicId, skillId: fixtureSkillId, errorType: "concept_error", isReviewed: true, reviewedAt: new Date() } });
  const countBefore = await prisma.practiceSession.count({ where: { userId: b.id } });
  assert.equal((await api(`/api/mistakes/${unavailable.id}/check`, b.cookie, "POST")).data.unavailable, true);
  assert.equal(await prisma.practiceSession.count({ where: { userId: b.id } }), countBefore);
  const legacy = await prisma.mistake.create({ data: { userId: b.id, questionId: `${runId}-original`, topicId: fixtureTopicId, errorType: "concept_error", isReviewed: true, reviewedAt: new Date() } });
  assert.equal((await api(`/api/mistakes/${legacy.id}/check`, b.cookie, "POST")).data.reason, "unmapped_skill");
  for (const suffix of ["seen", "helped", "fresh"]) {
    const q = await prisma.question.create({ data: { id: `${runId}-${suffix}`, topicId: fixtureTopicId, title: "test", questionText: "test",
      correctAnswer: "2", answerType: "number", explanation: "test", difficulty: 1,
      skills: { create: { skillId: fixtureSkillId } }, steps: { create: { order: 1, type: "numeric_input", prompt: "test", expectedAnswer: "2", skills: { create: { skillId: fixtureSkillId } } } } } });
    if (suffix === "seen") await answer(b, await practice(b, q.id, fixtureSkillId), q.id);
    if (suffix === "helped") await recordQuestionHelp(b.id, q.id);
    if (suffix !== "fresh") assert.equal((await api(`/api/mistakes/${unavailable.id}/check`, b.cookie, "POST")).data.unavailable, true, "Previously shown answers and help are excluded across sessions");
  }
  const eligible = await api(`/api/mistakes/${unavailable.id}/check`, b.cookie, "POST");
  assert.equal(eligible.status, 200);
  const eligibleSession = sessionFromHref(eligible.data.href), eligibleState = (await api(`/api/sessions/${eligibleSession}`, b.cookie)).data;
  assert.equal(eligibleState.question.id, `${runId}-fresh`);
  assert.doesNotMatch(JSON.stringify(eligibleState.question), /expectedAnswer|correctAnswer|isCorrect|explanation/);
  await answer(b, eligibleSession, eligibleState.question.id);
  assert.ok((await prisma.mistake.findUniqueOrThrow({ where: { id: unavailable.id } })).confirmedAt);
  const beforeMistakes = await prisma.mistake.findMany({ where: { userId: { in: users } }, orderBy: { id: "asc" } });
  const beforePlans = await prisma.dailyLearningPlan.findMany({ where: { userId: { in: users } }, include: { actions: true }, orderBy: { id: "asc" } });
  const require = createRequire(import.meta.url);
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file", "prisma/updates/20261004_daily_learning_plan.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
  await seedSkills(prisma);
  assert.deepEqual(await prisma.mistake.findMany({ where: { userId: { in: users } }, orderBy: { id: "asc" } }), beforeMistakes);
  assert.deepEqual(await prisma.dailyLearningPlan.findMany({ where: { userId: { in: users } }, include: { actions: true }, orderBy: { id: "asc" } }), beforePlans);
  assert.equal((await prisma.mistake.findUniqueOrThrow({ where: { id: legacy.id } })).confirmedAt, null);
  console.log("PASS: missing/unsuitable/unmapped questions leave errors unconfirmed; repeatable additive migration preserves old viewed flags, real confirmations and plan history");
}
async function cleanup() {
  const verified = await prisma.user.findMany({ where: { id: { in: users }, email: { startsWith: runId } }, select: { id: true } });
  const ids = verified.map((u) => u.id), where = { userId: { in: ids } };
  await prisma.$transaction(async (tx) => {
    await tx.dailyLearningPlan.deleteMany({ where }); await tx.learningCheck.deleteMany({ where }); await tx.skillReview.deleteMany({ where });
    await tx.questionHelp.deleteMany({ where }); await tx.mistake.deleteMany({ where });
    await tx.userStepAnswer.deleteMany({ where: { attempt: where } }); await tx.userAttempt.deleteMany({ where });
    await tx.practiceSession.deleteMany({ where }); await tx.userTopicProgress.deleteMany({ where }); await tx.dailyGoal.deleteMany({ where });
    await tx.diagnosticSession.deleteMany({ where }); await tx.user.deleteMany({ where: { id: { in: ids }, email: { startsWith: runId } } });
    if (fixtureTopicId && await tx.topic.findFirst({ where: { id: fixtureTopicId, name: runId } })) {
      await tx.questionStep.deleteMany({ where: { question: { topicId: fixtureTopicId } } });
      await tx.question.deleteMany({ where: { topicId: fixtureTopicId } });
      if (fixtureSkillId) await tx.skill.deleteMany({ where: { id: fixtureSkillId, topicId: fixtureTopicId } });
      await tx.topic.deleteMany({ where: { id: fixtureTopicId, name: runId } });
    }
  }, { timeout: 20000 });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { await cleanup(); } catch (error) { console.error("Could not clean up plan fixtures", error); process.exitCode = 1; }
  await prisma.$disconnect();
});
