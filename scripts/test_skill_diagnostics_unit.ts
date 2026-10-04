import assert from "node:assert/strict";
import { calculateSkillProgress, skillOutcomes, SkillObservationData } from "../lib/skillMastery";
import { calculateMasteryScore } from "../lib/mastery";
import { DIAGNOSTIC_EXERCISES, PRACTICE_EXERCISES, SKILLS } from "../lib/skillCatalog";
import { diagnosticDraftSchema, diagnosticSubmissionSchema } from "../lib/diagnostics";
import { explainSkillError } from "../lib/skillProgress";
import { validateExpressionOffline } from "../lib/mathEngine";

const now = new Date("2026-10-04T12:00:00Z");
const observation = (questionId: string, extra: Partial<SkillObservationData> = {}): SkillObservationData => ({
  questionId, isCorrect: true, isPartial: false, score: 100, usedHint: false, difficulty: 1,
  attemptNumber: 1, createdAt: now, ...extra,
});
assert.equal(calculateSkillProgress([], now).state, "insufficient");
assert.equal(calculateSkillProgress([observation("q1")], now).state, "insufficient");
assert.equal(calculateSkillProgress(Array.from({ length: 10 }, () => observation("q1")), now).state, "insufficient", "Repeated task is not independent evidence");
const independent = Array.from({ length: 8 }, (_, i) => observation(`q${i}`));
const afterThree = calculateSkillProgress(independent.slice(0, 3), now);
assert.equal(afterThree.masteryScore, 66);
assert.notEqual(afterThree.state, "mastered");
assert.equal(calculateSkillProgress(independent, now).state, "mastered");
assert.equal(calculateSkillProgress(independent.map((o) => ({ ...o, createdAt: new Date("2026-06-01") })), now).state, "insufficient");
assert.ok(calculateSkillProgress(independent, new Date(now.getTime() + 30 * 86400000)).masteryScore < calculateSkillProgress(independent, now).masteryScore);
const staleSuccesses = independent.map((o) => ({ ...o, createdAt: new Date("2025-01-01") }));
const freshFailures = [0, 1, 2].map((i) => observation(`fresh-${i}`, { isCorrect: false, score: 0 }));
assert.equal(calculateSkillProgress([...staleSuccesses, ...freshFailures], now).state, "weak", "New failures cannot revive stale mastery");
assert.ok(calculateSkillProgress(independent.map((o) => ({ ...o, usedHint: true })), now).masteryScore < calculateSkillProgress(independent, now).masteryScore);
assert.notEqual(calculateSkillProgress(independent.map((o) => ({ ...o, usedHint: true })), now).state, "mastered");
assert.ok(calculateSkillProgress(independent.map((o) => ({ ...o, attemptNumber: 2 })), now).masteryScore < calculateSkillProgress(independent, now).masteryScore);
assert.ok(calculateSkillProgress([observation("q", { isCorrect: false, isPartial: true, score: 50 })], now).masteryScore > 0);
let mastery = 0;
for (let i = 0; i < independent.length; i++) mastery = calculateMasteryScore(independent.slice(0, i + 1), mastery);
assert.equal(calculateSkillProgress(independent, now).masteryScore, mastery, "Skill mastery reuses the topic algorithm");
assert.deepEqual(skillOutcomes([{ id: "s1", skills: [{ skillId: "power_properties" }] }, { id: "s2", skills: [{ skillId: "bracket_signs" }] }, { id: "s3", skills: [] }],
  [{ stepId: "s1", isCorrect: true }, { stepId: "s2", isCorrect: false }, { stepId: "s3", isCorrect: false }]), [
  { skillId: "power_properties", score: 100, isCorrect: true, isPartial: false },
  { skillId: "bracket_signs", score: 0, isCorrect: false, isPartial: false },
]);
assert.deepEqual(skillOutcomes([{ id: "s1", skills: [{ skillId: "chain_rule" }] }, { id: "s2", skills: [{ skillId: "chain_rule" }] }],
  [{ stepId: "s1", isCorrect: true }, { stepId: "s2", isCorrect: false }]), [{ skillId: "chain_rule", score: 50, isCorrect: false, isPartial: true }]);
assert.equal(DIAGNOSTIC_EXERCISES.length, 9);
for (const skill of SKILLS) {
  assert.ok(skill.nameRu && skill.nameKk && skill.explanationRu && skill.explanationKk && skill.ruleRu && skill.ruleKk);
  assert.equal(DIAGNOSTIC_EXERCISES.filter((q) => q.steps.some((s) => s.skillIds.includes(skill.id))).length, 3);
  assert.ok(PRACTICE_EXERCISES.filter((q) => q.steps.some((s) => s.skillIds.includes(skill.id))).length >= 3);
}
for (const q of [...DIAGNOSTIC_EXERCISES, ...PRACTICE_EXERCISES]) for (const step of q.steps) {
  assert.ok(validateExpressionOffline(step.expectedAnswer, step.expectedAnswer).isEquivalent);
  for (const misconception of step.misconceptions) {
    assert.equal(validateExpressionOffline(misconception.answer, step.expectedAnswer).isEquivalent, false);
    assert.equal(explainSkillError(misconception.answer, step.expectedAnswer, step.misconceptions as never).ru, misconception.ru);
  }
}
assert.match(explainSkillError("banana", "-x-4", []).ru, /нельзя точно определить/);
assert.equal(diagnosticSubmissionSchema.safeParse({ submissionId: "bad", questionId: "q", revision: 0, stepAnswers: [] }).success, false);
assert.equal(diagnosticDraftSchema.safeParse({ revision: 0, currentIndex: 0, answers: { s: "x^(" } }).success, true);
console.log("PASS: evidence thresholds, independent observations, mastery alignment, hints/retries, partial scores, age decay, bilingual bank and exact misconception feedback");
