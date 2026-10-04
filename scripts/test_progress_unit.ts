import assert from "node:assert/strict";
import { calculateMasteryScore, calculateNextDifficulty } from "../lib/mastery";
import { summarizeAttempts } from "../lib/practiceStats";
import { submitAttemptSchema } from "../lib/validators";
import { createSubmissionId } from "../lib/client-submission";
import { webcrypto } from "node:crypto";

const success = { isCorrect: true, isPartial: false, score: 100, usedHint: false, difficulty: 1, attemptNumber: 1 };
const failure = { ...success, isCorrect: false, score: 0 };
const improving = [...Array(5).fill(failure), ...Array(5).fill(success)];
assert.ok(calculateMasteryScore(improving, 50) > calculateMasteryScore([...improving].reverse(), 50),
  "Recent successes must outweigh older failures");
assert.equal(calculateNextDifficulty(2, improving), 3, "Difficulty uses the latest five outcomes");
assert.equal(calculateNextDifficulty(2, [...improving].reverse()), 1);
assert.equal(calculateMasteryScore([success], 0), 30);
assert.equal(calculateMasteryScore([{ ...success, usedHint: true }], 0), 26);
assert.equal(calculateMasteryScore([{ ...success, usedHint: true, attemptNumber: 2 }], 0), 23);
assert.equal(calculateMasteryScore([failure, ...improving], 50), calculateMasteryScore(improving, 50));
assert.equal(calculateMasteryScore([], 42), 42);
assert.deepEqual(summarizeAttempts([
  { questionId: "a", isCorrect: false }, { questionId: "a", isCorrect: true },
  { questionId: "a", isCorrect: false }, { questionId: "b", isCorrect: true },
]), { completedCount: 2, correctCount: 2, attemptCount: 4, correctAttemptCount: 2 });

const payload = { submissionId: "e914b0ba-7aab-42b8-b48a-c3d0939b099b", sessionId: "s", questionId: "q",
  stepAnswers: [{ stepId: "one", answer: "2" }] };
assert.equal(submitAttemptSchema.safeParse(payload).success, true);
assert.equal(submitAttemptSchema.safeParse({ ...payload, submissionId: undefined }).success, false);
assert.equal(submitAttemptSchema.safeParse({ ...payload, stepAnswers: [...payload.stepAnswers, ...payload.stepAnswers] }).success, false);
assert.equal(submitAttemptSchema.safeParse({ ...payload, stepAnswers: [] }).success, false);
const localHttpCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } as Pick<Crypto, "getRandomValues">;
const id = createSubmissionId(localHttpCrypto);
assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.notEqual(id, createSubmissionId(localHttpCrypto));
console.log("PASS: recent mastery weights, latest difficulty, hint/retry penalties, unique task counts and submission validation");
