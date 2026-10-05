import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { EXAM_EXERCISES } from "../lib/exam/bank";
import { TIPO_MATH } from "../lib/exam/profile";

const prisma = new PrismaClient();
const base = process.env.EXAM_TEST_BASE_URL ?? "http://127.0.0.1:3100";
const email = `exam-http-${randomUUID()}@example.test`;
let userId: string | undefined;
async function main() {
  const guest = await fetch(`${base}/api/exam-coverage`);
  assert.equal(guest.status, 401);
  assert.match(guest.headers.get("cache-control") ?? "", /no-store/);
  const registered = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Exam audit test", email, password: "audit-test-password-123" }) });
  assert.equal(registered.status, 200); userId = (await registered.json()).user.id;
  const cookie = registered.headers.get("set-cookie")!.split(";")[0];
  const response = await fetch(`${base}/api/exam-coverage?profile=${TIPO_MATH.id}`, { headers: { cookie } });
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const report = await response.json();
  assert.equal(report.totals.databaseQuestions, await prisma.question.count());
  assert.equal(report.profile.documentYear, 2023);
  assert.equal(report.points.find((p: any) => p.code === "15").status, "uncovered");
  assert.equal(report.readiness.multipleVariants.canGenerate, false);
  assert.equal((await fetch(`${base}/api/exam-coverage?profile=nonexistent`, { headers: { cookie } })).status, 404);
  const page = await fetch(`${base}/exam-coverage?profile=${TIPO_MATH.id}`, { headers: { cookie } });
  assert.equal(page.status, 200); const html = await page.text();
  for (const text of ["Не покрыто", "Формат отсутствует", "2023", "120 минут", "Официальные источники", "внутренняя квота"]) assert.ok(html.includes(text), text);
  const q = await prisma.question.findUniqueOrThrow({ where: { id: EXAM_EXERCISES[0].id }, include: { skills: true, steps: { include: { options: true } } } });
  const started = await fetch(`${base}/api/sessions`, { method: "POST", headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "mixed", totalCount: 1, questionId: q.id, skillId: q.skills[0].skillId }) });
  assert.equal(started.status, 200); const sessionId = (await started.json()).id;
  const submitted = await fetch(`${base}/api/attempts`, { method: "POST", headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId: randomUUID(), sessionId, questionId: q.id, usedHint: false,
      stepAnswers: [{ stepId: q.steps[0].id, answer: q.steps[0].options.find((o) => o.isCorrect)!.id }] }) });
  assert.equal(submitted.status, 200); assert.equal((await submitted.json()).isCorrect, true);
  assert.equal(await prisma.skillObservation.count({ where: { userId, skillId: q.skills[0].skillId, isCorrect: true } }), 1);
  const plan = await fetch(`${base}/api/learning-plan`, { headers: { cookie } });
  assert.equal(plan.status, 200);
  assert.equal((await plan.json()).actions.find((a: any) => a.kind === "rule").skillId, q.skills[0].skillId,
    "An observed exam skill must participate in the plan without requiring diagnostic catalog membership");
  console.log("PASS: authenticated live API, unknown profile, no-cache counts, rendered gaps/sources, new MC submission, skill evidence and planning.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (userId && await prisma.user.findFirst({ where: { id: userId, email } })) {
    const where = { userId };
    await prisma.$transaction(async (tx) => {
      await tx.userStepAnswer.deleteMany({ where: { attempt: where } }); await tx.userAttempt.deleteMany({ where });
      await tx.practiceSession.deleteMany({ where }); await tx.userTopicProgress.deleteMany({ where });
      await tx.dailyGoal.deleteMany({ where }); await tx.user.deleteMany({ where: { id: userId, email } });
    });
  }
  await prisma.$disconnect();
});
