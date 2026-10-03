export interface AttemptOutcome {
  questionId: string;
  isCorrect: boolean;
}

/** A question counts once; every deliberate retry remains a separate attempt. */
export function summarizeAttempts(attempts: AttemptOutcome[]) {
  return {
    completedCount: new Set(attempts.map((attempt) => attempt.questionId)).size,
    correctCount: new Set(attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.questionId)).size,
    attemptCount: attempts.length,
    correctAttemptCount: attempts.filter((attempt) => attempt.isCorrect).length,
  };
}
