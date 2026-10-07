import assert from "node:assert/strict";
import { assessSkills, orderProgramSkills, PREPARATION_POLICY } from "../lib/learning-road/program-policy";
import { calculateSkillProgress } from "../lib/skillMastery";
import { gradeExamQuestion, publicExamQuestion, type PaperQuestion } from "../lib/exam/mode";
import { TIPO_MATH } from "../lib/exam/profile";
import { testChoice } from "./choice_test_fixture";
import { contentKey } from "../lib/learning-road/program-bank";

const now = new Date();
const observation = { questionId: "q", createdAt: now, score: 0, isCorrect: false, isPartial: false, usedHint: false, difficulty: 1, attemptNumber: 1 };
assert.equal(calculateSkillProgress([]).state, "insufficient");
assert.equal(calculateSkillProgress([observation]).state, "insufficient");
assert.equal(calculateSkillProgress([1, 2, 3].map(i => ({ ...observation, questionId: String(i) }))).state, "weak");
const answers = [1, 2, 3, 4].map(() => ({ skillIds: ["a"], isCorrect: true, independent: true }));
assert.equal(assessSkills(answers, ["a"], "SKILL").passed, true);
assert.equal(assessSkills(answers.slice(0, 1), ["a"], "SKILL").passed, false);
assert.equal(assessSkills(answers.map((a, i) => ({ ...a, isCorrect: i < 3 })), ["a"], "SKILL").passed, true);
assert.equal(assessSkills(answers.map((a, i) => ({ ...a, independent: i < 2 })), ["a"], "SKILL").passed, false, "Help/revealed answers cannot confirm a block");
assert.deepEqual(assessSkills([...answers, { skillIds: ["b"], isCorrect: false, independent: true }], ["a", "b"], "MIXED").gapSkillIds, ["b"]);
assert.equal(assessSkills(answers, ["a"], "SKILL", { ...PREPARATION_POLICY, blockSize: 5 }).passed, false);
const skills = [{ id: "advanced", state: "weak", due: false, failures: 4 }, { id: "foundation", state: "insufficient", due: false, failures: 0 }, { id: "old", state: "mastered", due: true, failures: 0 }];
const order = orderProgramSkills(skills, { advanced: ["foundation"] }).map(s => s.id);
assert.ok(order.indexOf("foundation") < order.indexOf("advanced")); assert.equal(order[0], "old");
assert.deepEqual(orderProgramSkills([...skills].reverse(), { advanced: ["foundation"] }).map(s => s.id), order);
assert.throws(() => orderProgramSkills(skills, { advanced: ["foundation"], foundation: ["advanced"] }), /Cyclic/);
assert.equal(contentKey(" $x + 2$ "), contentKey("x+2"));
const choice = testChoice("control");
const paper: PaperQuestion = { id: "q", contentHash: "hash", pointCode: "p", band: "A", family: "f", topicId: "t", topicName: "topic",
  skillIds: ["a"], skillNames: ["A"], title: "Question", questionText: choice.questionText, latex: null,
  options: choice.options.map(o => o.text), correctIndex: 0, explanation: choice.explanation, difficulty: 1, previouslyExposed: false, controlChoice: choice };
assert.equal(gradeExamQuestion(TIPO_MATH, paper, 0).isCorrect, true);
assert.equal(gradeExamQuestion(TIPO_MATH, paper, 4).isCorrect, false);
assert.throws(() => gradeExamQuestion(TIPO_MATH, { ...paper, controlChoice: undefined, options: paper.options.slice(0, 4) }, 4), /Invalid/);
assert.doesNotMatch(JSON.stringify(publicExamQuestion(paper)), /controlChoice|correctIndex|explanation|correctOptionIds/);
console.log("PASS preparation policy: insufficient vs weak, independent evidence, configurable thresholds, mixed gaps, deterministic prerequisites, A–E and unchanged four-choice grading, private snapshots.");
