import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { seedExamBank } from "../prisma/examSeed";
import { EXAM_EXERCISES } from "../lib/exam/bank";
import { TIPO_MATH } from "../lib/exam/profile";
import { readCoverage } from "../lib/exam/database";
import { questionFingerprint } from "../lib/exam/fingerprint";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient(), fixtureId = `exam-test-${randomUUID()}`;
async function main() {
  const source = TIPO_MATH.sources.find((s) => s.id === "specification")!;
  assert.equal(createHash("sha256").update(readFileSync(`public${source.snapshotUrl}`)).digest("hex"), source.sha256);
  const before = await prisma.question.findMany({ include: { skills: true, steps: { include: { options: true } } } });
  const fingerprints = new Map(before.map((q) => [q.id, questionFingerprint(q)]));
  await seedExamBank(prisma);
  const once = await prisma.question.count();
  const links = await prisma.questionSkill.count();
  const steps = await prisma.questionStep.count();
  const options = await prisma.questionOption.count();
  await Promise.all([seedExamBank(prisma), seedExamBank(prisma)]);
  assert.equal(await prisma.question.count(), once, "Repeated seed duplicated questions");
  assert.equal(await prisma.questionSkill.count(), links, "Repeated seed duplicated skill links");
  assert.equal(await prisma.questionStep.count(), steps);
  assert.equal(await prisma.questionOption.count(), options);
  const after = await prisma.question.findMany({ include: { skills: true, steps: { include: { options: true } } } });
  for (const q of after) if (fingerprints.has(q.id)) assert.equal(questionFingerprint(q), fingerprints.get(q.id), "Existing content was overwritten");
  assert.equal(await prisma.question.count({ where: { id: { in: EXAM_EXERCISES.map((q) => q.id) } } }), EXAM_EXERCISES.length);
  const report = await readCoverage(prisma, TIPO_MATH);
  assert.equal(report.totals.databaseQuestions, once);
  assert.equal(report.totals.direct + report.totals.supporting + report.totals.outside + report.totals.needsReview, once);
  assert.equal(report.questions.length, once);
  assert.equal(report.questions.filter((q) => q.id.startsWith("exam_v1_") && q.eligible).length, EXAM_EXERCISES.length);
  assert.equal(report.questions.filter((q) => q.id.startsWith("exam_v1_") && q.missingSkills.length > 0).length, 0);
  assert.equal(report.readiness.multipleVariants.canGenerate, false);
  // An unknown DB task is included in live totals but never silently approved by its topic.
  await prisma.question.create({ data: { id: fixtureId, topicId: "t13", title: "Audit fixture", questionText: "2+2", answerType: "number", correctAnswer: "4", explanation: "4" } });
  const withFixture = await readCoverage(prisma, TIPO_MATH);
  assert.equal(withFixture.totals.databaseQuestions, once + 1);
  assert.equal(withFixture.questions.find((q) => q.id === fixtureId)!.quality, "needs_review");
  console.log("Database coverage checks passed: real totals, exact references, seed concurrency/idempotence, preserved history content, unknown tasks, unavailable variants.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await prisma.question.deleteMany({ where: { id: fixtureId } }); await prisma.$disconnect();
});
