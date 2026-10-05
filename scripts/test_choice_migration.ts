import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { Prisma } from "@prisma/client";
import { choiceFixture, api, submission, prisma, testChoice } from "./choice_test_fixture";
import { seedPracticeChoices } from "../prisma/practiceChoiceSeed";

async function main() {
  const f = await choiceFixture();
  try {
    await seedPracticeChoices(prisma);
    const oldDraft = { oldStep: "x^2 + unfinished calculation" };
    const legacy = await prisma.practiceSession.create({ data: { userId: f.a.id, mode: "mixed", questionIds: [f.q(0)],
      totalCount: 1, draftAnswers: oldDraft } });
    const oldStep = await prisma.questionStep.findFirstOrThrow({ where: { questionId: f.q(0) } });
    const oldAttempt = await prisma.userAttempt.create({ data: { userId: f.a.id, sessionId: legacy.id,
      questionId: f.q(0), isCorrect: true, score: 100, stepAnswers: { create: { stepId: oldStep.id, answer: "7", isCorrect: true } } } });
    await prisma.practiceSession.update({ where: { id: legacy.id }, data: { currentAttemptId: oldAttempt.id } });
    const questionBefore = await prisma.question.findUniqueOrThrow({ where: { id: "exam_v1_derivative_fraction" },
      include: { steps: { orderBy: { order: "asc" }, include: { options: { orderBy: { id: "asc" } } } } } });
    const attemptsBefore = await prisma.userAttempt.findMany({ where: { userId: f.a.id }, include: { stepAnswers: true } });
    const frozen = await f.session(f.a.id, [f.q(1)]);
    const path = `/api/sessions/${frozen.id}`;
    const original = (await api(path, f.a.cookie)).data.question;
    const require = createRequire(import.meta.url);
    const countsBefore = [await prisma.user.count(), await prisma.question.count(), await prisma.userAttempt.count()];
    for (let run = 0; run < 2; run++) {
      execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "execute", "--file",
        "prisma/updates/20261005_multiple_choice_practice.sql", "--schema", "prisma/schema.prisma"], { stdio: "pipe" });
      assert.equal((await seedPracticeChoices(prisma)).ready, 0, "A repeated content upgrade makes no writes");
    }
    assert.deepEqual([await prisma.user.count(), await prisma.question.count(), await prisma.userAttempt.count()], countsBefore);
    assert.deepEqual(await prisma.question.findUniqueOrThrow({ where: { id: questionBefore.id },
      include: { steps: { orderBy: { order: "asc" }, include: { options: { orderBy: { id: "asc" } } } } } }), questionBefore,
      "Official exam steps, options, answer and metadata are unchanged");
    assert.deepEqual(await prisma.userAttempt.findMany({ where: { userId: f.a.id }, include: { stepAnswers: true } }), attemptsBefore);
    const migrated = await prisma.practiceSession.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.deepEqual(migrated.legacyDraftAnswers, oldDraft); assert.deepEqual(migrated.draftAnswers, oldDraft);
    assert.equal(migrated.currentAttemptId, oldAttempt.id); assert.equal(migrated.currentIndex, 0);
    const restored = (await api(`/api/sessions/${legacy.id}`, f.a.cookie)).data;
    assert.equal(restored.result.stepResults[0].userAnswer, "7"); assert.equal(restored.result.score, 100);
    // Editing the bank after creation must not change a saved paper or its grading key.
    const edited = testChoice(f.q(1)); edited.options.reverse(); edited.correctOptionIds = [f.q(1) + "-1"];
    edited.questionText = "Changed bank condition"; edited.explanation = "Changed bank explanation";
    await prisma.question.update({ where: { id: f.q(1) }, data: { practiceChoice: edited as unknown as Prisma.InputJsonValue } });
    assert.deepEqual((await api(path, f.a.cookie)).data.question, original);
    const checked = await api("/api/attempts", f.a.cookie, "POST", submission(frozen.id, f.q(1), f.q(1) + "-0"));
    assert.equal(checked.status, 200); assert.equal(checked.data.score, 100); assert.equal(checked.data.explanation, "3+4=7.");
    console.log("PASS: repeatable additive migration and seed, archived free-text drafts, preserved users/attempts/exam content, legacy results and immutable practice order/keys");
  } finally { await f.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
