import assert from "node:assert/strict";
import { EXAM_EXERCISES, exerciseQuestion } from "../lib/exam/bank";
import { TIPO_MATH } from "../lib/exam/profile";
import { CONTENT_REVIEWS, validateReviewReferences } from "../lib/exam/reviews";
import { auditCoverage } from "../lib/exam/coverage";
import { examFormat } from "../lib/exam/fingerprint";
import { assessExamReadiness, type ExamCandidate } from "../lib/exam/readiness";
import { generateStereometry, generateLogarithms, generateTrigonometry, generateDiffEq2, generateTangent } from "../lib/questionGenerator";

validateReviewReferences();
assert.equal(TIPO_MATH.documentYear, 2023);
assert.equal(TIPO_MATH.official.mathBlockMinutes, null);
assert.equal(TIPO_MATH.official.topicQuotas, null);
assert.equal(TIPO_MATH.points.length, 20);
assert.equal(new Set(EXAM_EXERCISES.map((q) => q.id)).size, EXAM_EXERCISES.length);
const first = CONTENT_REVIEWS[0];
assert.throws(() => validateReviewReferences([{ ...first, pointCode: "999" }]), /Invalid specification point/);
assert.throws(() => validateReviewReferences([{ ...first, profileVersion: "999" }]), /Unknown profile/);
assert.throws(() => validateReviewReferences([{ ...first, skillIds: ["nonexistent"] }]), /Invalid point skill/);
assert.throws(() => validateReviewReferences([first, first]), /Duplicate content review/);
assert.throws(() => validateReviewReferences([{ ...CONTENT_REVIEWS.find((r) => r.quality === "direct")!, skillIds: [] }]), /Invalid point skill/);
const bank = EXAM_EXERCISES.map(exerciseQuestion);
bank.forEach((q) => assert.equal(examFormat(q), "single_choice_4", q.id));
const report = auditCoverage(TIPO_MATH, bank);
assert.equal(report.totals.databaseQuestions, EXAM_EXERCISES.length);
assert.equal(report.totals.direct, EXAM_EXERCISES.length);
assert.equal(report.totals.eligible, EXAM_EXERCISES.length);
assert.equal(report.points.reduce((n, p) => n + p.direct, 0), EXAM_EXERCISES.length);
assert.equal(report.readiness.oneVariant.canGenerate, true);
assert.equal(report.readiness.multipleVariants.canGenerate, false);
assert.equal(report.readiness.balancedVariant.canGenerate, true);
const originalBank = bank.filter((q) => !["12", "15", "16"].some((p) => q.skills.some((s) => TIPO_MATH.points.find((point) => point.code === p)!.skills.includes(s.skillId))));
const originalReport = auditCoverage(TIPO_MATH, originalBank);
assert.equal(originalReport.readiness.balancedVariant.canGenerate, false);
assert.equal(originalReport.points.find((p) => p.code === "15")!.status, "uncovered");
assert.equal(originalReport.sections.find((s) => s.section.startsWith("09."))!.status, "uncovered");
// A covered section becomes genuinely uncovered when its tasks are absent.
const absent = auditCoverage(TIPO_MATH, bank.filter((q) => q.topicId !== "exam_surfaces"));
for (const code of ["17", "18"]) {
  const point = absent.points.find((p) => p.code === code)!;
  assert.equal(point.direct, 0); assert.equal(point.status, "uncovered"); assert.equal(point.missingFormat, true);
}
// Known content edits invalidate review; topic/title changes cannot confer coverage.
const changed = { ...bank[0], correctAnswer: "Неверный ответ", topicId: "t13" };
const stale = auditCoverage(TIPO_MATH, [changed]);
assert.equal(stale.totals.needsReview, 1); assert.equal(stale.totals.eligible, 0);
assert.match(stale.questions[0].rationale, /изменилось/);
const missingLink = auditCoverage(TIPO_MATH, [{ ...bank[0], skills: [] }]);
assert.equal(missingLink.totals.eligible, 0); assert.equal(missingLink.questions[0].missingSkills.length, 1);
// A multi-step training problem with MC intermediate steps is not an exam task.
assert.equal(examFormat({ ...bank[0], steps: [bank[0].steps[0], { ...bank[0].steps[0], order: 2 }] }), "training");
const badChoices = structuredClone(bank[0]); badChoices.steps[0].options[1] = { ...badChoices.steps[0].options[0], order: 2 };
assert.equal(examFormat(badChoices), "invalid_choice");
const copies = auditCoverage(TIPO_MATH, [bank[0], { ...bank[0], id: "copy" }]);
assert.equal(copies.totals.databaseQuestions, 2); assert.equal(copies.totals.uniqueEligible, 1);
assert.equal(copies.points.find((p) => p.code === EXAM_EXERCISES[0].pointCode)!.families, 1); assert.equal(copies.duplicateGroups.length, 1);
assert.throws(() => auditCoverage(TIPO_MATH, [bank[0], bank[0]]), /Duplicate question IDs/);

// Greedy selection could spend every flexible A/B family on A and leave B short.
// Max-flow can move those families to B and use A-only families for A.
const candidates: ExamCandidate[] = [];
for (let i = 0; i < 10; i++) for (const band of ["A", "B"] as const) candidates.push({
  id: `${i}${band}`, pointCode: "01", band, family: `flex${i}`, contentHash: `${i}${band}` });
for (let i = 0; i < 5; i++) for (const band of ["A", "C"] as const) candidates.push({
  id: `only${i}${band}`, pointCode: "02", band, family: `only${i}${band}`, contentHash: `only${i}${band}` });
assert.equal(assessExamReadiness(TIPO_MATH, candidates).canGenerate, true);
assert.equal(assessExamReadiness(TIPO_MATH, candidates, 2).canGenerate, false);
assert.equal(assessExamReadiness(TIPO_MATH, candidates, 1, true).canGenerate, false);
assert.throws(() => assessExamReadiness(TIPO_MATH, candidates, 0), /1..10/);
assert.throws(() => assessExamReadiness(TIPO_MATH, [{ ...candidates[0], pointCode: "999" }]), /Invalid/);
// Boundary coefficients exposed rounded volumes and duplicate correct distractors.
const random = Math.random;
try {
  for (const value of [0, 0.3, 0.7, 0.999]) {
    Math.random = () => value;
    for (const generate of [generateStereometry, generateLogarithms, generateTrigonometry, generateDiffEq2, generateTangent]) {
      const q = generate();
      for (const s of q.steps.filter((s) => s.type === "multiple_choice")) {
        assert.equal(new Set(s.options.map((o) => o.text)).size, 4);
        assert.equal(s.options.filter((o) => o.isCorrect).length, 1);
      }
      if (generate === generateStereometry) {
        assert.equal(q.topicId, "exam_volumes");
        const [, a, h] = /сторона основания равна (\d+), а высота равна (\d+)/.exec(q.questionText)!;
        const [n, d = "1"] = q.correctAnswer.split("/");
        assert.equal(Number(n) * 3, Number(a) ** 2 * Number(h) * Number(d), "Volume must be exact");
      }
    }
  }
  const draws = [0.999, 0]; Math.random = () => draws.shift() ?? 0;
  const ode = generateDiffEq2();
  assert.equal(ode.correctAnswer, "k_1 = 4, k_2 = 5");
  assert.ok(!ode.steps.at(-1)!.options.some((o) => !o.isCorrect && o.text === "k_1 = 5, k_2 = 4"));
} finally { Math.random = random; }
console.log("Exam coverage unit checks passed: references, absent points, stale reviews, formats, diversity, constrained availability.");
