import assert from "node:assert/strict";
import { buildLearningRoad, roadStatuses } from "../lib/learning-road/builder";
import { skillGraph, SKILL_PREREQUISITES } from "../lib/learning-road/graph";
import { roadText } from "../lib/i18n/learning-road";
import type { RoadSkillState, SkillGraphEntry } from "../lib/learning-road/types";

const skill = (id: string, changes: Partial<RoadSkillState> = {}): RoadSkillState => ({ id,
  state: "insufficient", masteryScore: 0, distinctQuestions: 0, observationCount: 0, daysSincePractice: 0,
  recentMistakes: 0, diagnosticFailures: 0, hints: 0, due: false, practiceCount: 8, ...changes });
const graph: SkillGraphEntry[] = [{ id: "target", prerequisites: ["base"], coverage: true },
  ...["base", "review", "coverage", "mastered"].map(id => ({ id, prerequisites: [], coverage: true }))];
const input = [skill("target", { state: "weak", masteryScore: 15, distinctQuestions: 5, observationCount: 7, recentMistakes: 3 }),
  skill("base", { state: "developing", masteryScore: 55, distinctQuestions: 4, observationCount: 4 }),
  skill("review", { state: "mastered", masteryScore: 95, due: true }), skill("coverage"),
  skill("mastered", { state: "mastered", masteryScore: 99 })];
const before = structuredClone(input), road = buildLearningRoad(input, graph);
assert.ok(road.length >= 5 && road.length <= 8);
assert.equal(road[0].skillId, "base"); // Explicit preparation receives priority.
assert.equal(road[0].reason, "prerequisite");
assert.ok(road.findIndex(node => node.skillId === "target") < road.findIndex(node => node.reason === "coverage"));
assert.ok(road.some(node => node.type === "REVIEW" && node.skillId === "review"));
assert.ok(!road.some(node => node.skillId === "mastered"));
assert.ok(road.some(node => node.skillId === "coverage" && node.type === "PRACTICE"));
assert.ok(road.some(node => node.skillId === "target")); // Recommendations never remove a dependent skill.
assert.deepEqual(input, before); // No mastery or learning-state mutation.
assert.deepEqual(buildLearningRoad(input, graph), road);
assert.deepEqual(buildLearningRoad([...input].reverse(), graph), road);
assert.deepEqual(roadStatuses([{ completedAt: true }, { completedAt: null }, { completedAt: true }, { completedAt: null }]),
  ["COMPLETED", "CURRENT", "COMPLETED", "UPCOMING"]);
assert.deepEqual(roadStatuses([{ completedAt: true }]), ["COMPLETED"]);
assert.ok(!buildLearningRoad(input, graph.map(entry => ({ ...entry, prerequisites: [] }))).some(node => node.reason === "prerequisite"));
assert.equal(buildLearningRoad([skill("mastered", { state: "mastered" })], graph).length, 0);
assert.equal(buildLearningRoad([skill("missing", { practiceCount: 0 })], []).length, 0);
const sparse = buildLearningRoad([skill("diagnostic", { observationCount: 1, diagnosticFailures: 1 })], []);
assert.ok(sparse.every(node => node.type !== "REPAIR")); // One wrong answer cannot classify a whole skill.
assert.ok(sparse.some(node => node.reason === "evidence"));
const noGraph = skillGraph(["chain_rule", "power_properties"]);
assert.deepEqual(noGraph.find(entry => entry.id === "chain_rule")?.prerequisites, []);
for (const [id, prerequisites] of Object.entries(SKILL_PREREQUISITES)) assert.ok(!prerequisites.includes(id));
for (const locale of ["ru", "kk", "en"] as const) {
  const copy = roadText[locale];
  assert.equal(Object.keys(copy.types).length, 5); assert.equal(Object.keys(copy.statuses).length, 3);
  assert.deepEqual(Object.keys(copy.reasons), Object.keys(roadText.ru.reasons));
  // There is no error classification input, and no inferred concrete mistake in the explanation.
  assert.ok(copy.reasons.weak.length > 20);
  assert.ok(!/4 раза|поменять знак|забыл|forgot|төрт рет/i.test(copy.reasons.weak));
}
console.log("PASS: weak priority, due review, mastered exclusion, evidence, explicit prerequisites, open access, statuses, immutable mastery, determinism and neutral RU/KK/EN explanations");
