import assert from "node:assert/strict";
import { addDays, dayBounds, dayStart, independentCheck, localDay, nextReview, rankPlanSkills, studentTimeZone } from "../lib/learningPolicy";
import { DAILY_EXERCISES } from "../lib/dailyLearningBank";
import { learningText } from "../lib/i18n/learning";

assert.equal(studentTimeZone(null), "Asia/Qyzylorda");
assert.equal(studentTimeZone("invalid"), "Asia/Qyzylorda");
assert.equal(localDay(new Date("2026-10-04T18:59:59.999Z"), "Asia/Qyzylorda"), "2026-10-04");
assert.equal(localDay(new Date("2026-10-04T19:00:00Z"), "Asia/Qyzylorda"), "2026-10-05");
assert.equal(dayStart("2026-10-05", "Asia/Qyzylorda").toISOString(), "2026-10-04T19:00:00.000Z");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
for (const [date, hours] of [["2026-03-08T12:00:00Z", 23], ["2026-11-01T12:00:00Z", 25]] as const) {
  const bounds = dayBounds(new Date(date), "America/New_York");
  assert.equal((bounds.lt.getTime() - bounds.gte.getTime()) / 3600000, hours);
}
const now = new Date("2026-10-04T19:00:00Z");
assert.deepEqual([0, 1, 2, 3].map((index) => nextReview(now, "Asia/Qyzylorda", index, true).dueDay),
  ["2026-10-08", "2026-10-12", "2026-10-19", "2026-10-19"]);
assert.equal(nextReview(now, "Asia/Qyzylorda", 3, false).dueDay, "2026-10-06");
assert.equal(nextReview(now, "Asia/Qyzylorda", 3, true, true).dueDay, "2026-10-06");
const signal = { id: "a", state: "good", masteryScore: 80, due: false, recentMistakes: 0, diagnosticFailures: 0, hints: 0, daysSincePractice: 0 };
assert.equal(rankPlanSkills([signal, { ...signal, id: "due", due: true }, { ...signal, id: "weak", state: "weak", diagnosticFailures: 3 }])[0].id, "due");
for (const patch of [{ recentMistakes: 1 }, { diagnosticFailures: 1 }, { hints: 1 }, { daysSincePractice: 20 }]) {
  assert.equal(rankPlanSkills([signal, { ...signal, ...patch, id: "target" }])[0].id, "target");
}
assert.deepEqual(rankPlanSkills([signal])[0].reasons, ["maintenance"]);
const proof = { isCorrect: true, usedHint: false, priorAttempts: 0, priorHelp: false, questionId: "new", originalQuestionId: "old", testsSkill: true, difficulty: 2, targetDifficulty: 1 };
assert.equal(independentCheck(proof), true);
for (const patch of [{ isCorrect: false }, { usedHint: true }, { priorAttempts: 1 }, { priorHelp: true }, { questionId: "old" }, { testsSkill: false }, { difficulty: 4 }]) assert.equal(independentCheck({ ...proof, ...patch }), false);
assert.equal(DAILY_EXERCISES.length, 30);
assert.equal(new Set(DAILY_EXERCISES.map((q) => q.id)).size, 30);
assert.ok(DAILY_EXERCISES.every((q) => q.questionTextKk && q.explanationKk && q.steps[0].skillIds.length === 1));
assert.deepEqual(Object.keys(learningText.ru).sort(), Object.keys(learningText.kk).sort());
assert.deepEqual(Object.keys(learningText.ru.reasons).sort(), Object.keys(learningText.kk.reasons).sort());
console.log("PASS: local midnight, fallback zone, leap/year boundaries, 23/25-hour days, 1/3/7/14 spacing, ranking signals and independent proof policy");
console.log("PASS: finite bilingual bank, stable IDs and RU/KK text parity");
