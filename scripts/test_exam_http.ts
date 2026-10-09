import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { TIPO_MATH } from "../lib/exam/profile";
import { readExamAvailability } from "../lib/exam/session";

const prisma = new PrismaClient(), base = process.env.EXAM_TEST_BASE_URL ?? "http://127.0.0.1:3100";
const email = `exam-availability-${randomUUID()}@example.test`;
let userId: string | undefined;
async function main() {
  assert.equal((await fetch(`${base}/api/exam-coverage`)).status, 410);
  const guest = await fetch(`${base}/api/exams/availability`);
  assert.equal(guest.status, 401);
  assert.match(guest.headers.get("cache-control") ?? "", /no-store/);
  const registered = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Exam availability test", email, password: "audit-test-password-123" }) });
  assert.equal(registered.status, 200); userId = (await registered.json()).user.id;
  const cookie = registered.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await fetch(`${base}/api/exam-coverage`, { headers: { cookie } })).status, 410);
  const response = await fetch(`${base}/api/exams/availability`, { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const result = await response.json();
  assert.deepEqual(Object.keys(result), ["languages"]);
  assert.deepEqual(result.languages.map((s: { language: string }) => s.language), ["ru", "kk"]);
  for (const language of ["ru", "kk"] as const) {
    const actual = await prisma.$transaction(tx => readExamAvailability(tx, TIPO_MATH, language));
    const summary = result.languages.find((item: { language: string }) => item.language === language);
    assert.equal(summary.canGenerate, actual.readiness.canGenerate);
    assert.deepEqual(summary.missingPointCodes, actual.shortages.map(point => point.pointCode));
    assert.deepEqual(Object.keys(summary).sort(), ["canGenerate", "language", "missingPointCodes"]);
  }
  assert.equal(await prisma.examSession.count({ where: { userId } }), 0, "Checking availability cannot create an attempt");
  console.log("PASS: private audit retired, authenticated availability matches real exam constraints in RU/KK, no keys or side effects.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (userId && await prisma.user.findFirst({ where: { id: userId, email } })) {
    await prisma.$transaction(async tx => {
      await tx.dailyGoal.deleteMany({ where: { userId } });
      await tx.user.deleteMany({ where: { id: userId, email } });
    });
  }
  await prisma.$disconnect();
});
