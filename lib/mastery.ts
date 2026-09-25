/**
 * Mastery score calculation algorithm.
 *
 * masteryScore is a value from 0 to 100 representing how well
 * the user knows a topic.
 *
 * Algorithm:
 * - Take up to last 10 attempts for this topic
 * - Apply exponential weights (newer = higher weight)
 * - Apply bonuses/penalties based on hints, difficulty, attempt number
 * - Clamp to [0, 100]
 */

interface AttemptData {
  isCorrect: boolean;
  isPartial: boolean;
  score: number;
  usedHint: boolean;
  difficulty: number; // 1-5
  attemptNumber: number;
}

// Exponential weights for last 10 attempts (index 0 = oldest)
const ATTEMPT_WEIGHTS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.7, 2.0];

/**
 * Calculate mastery score from recent attempts.
 * @param attempts - Last N attempts, sorted oldest first
 * @param currentScore - Current mastery score
 */
export function calculateMasteryScore(
  attempts: AttemptData[],
  currentScore: number
): number {
  if (attempts.length === 0) return currentScore;

  // Take last 10 attempts
  const recent = attempts.slice(-10);
  const weights = ATTEMPT_WEIGHTS.slice(-recent.length);

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < recent.length; i++) {
    const attempt = recent[i];
    const weight = weights[i] ?? 1.0;

    // Base score for attempt
    let attemptScore = attempt.isCorrect
      ? 100
      : attempt.isPartial
        ? attempt.score
        : 0;

    // Penalty for using hint
    if (attempt.usedHint) {
      attemptScore = Math.max(0, attemptScore - 15);
    }

    // Penalty for multiple attempts on same question
    if (attempt.attemptNumber > 1) {
      attemptScore = Math.max(0, attemptScore - (attempt.attemptNumber - 1) * 10);
    }

    // Bonus for solving hard questions correctly
    if (attempt.isCorrect && attempt.difficulty >= 4) {
      attemptScore = Math.min(100, attemptScore + 5);
    }

    weightedSum += attemptScore * weight;
    totalWeight += weight;
  }

  const newScore = totalWeight > 0 ? weightedSum / totalWeight : currentScore;

  // Smooth transition: 70% current + 30% new calculation
  // This prevents wild swings from a single attempt
  const smoothed = currentScore * 0.7 + newScore * 0.3;

  return Math.round(Math.min(100, Math.max(0, smoothed)));
}

/**
 * Calculate the next difficulty level to give the user.
 * Uses a simple adaptive algorithm.
 */
export function calculateNextDifficulty(
  currentLevel: number,
  recentResults: { isCorrect: boolean }[]
): number {
  if (recentResults.length < 3) return currentLevel;

  const recent5 = recentResults.slice(-5);
  const correctCount = recent5.filter((r) => r.isCorrect).length;
  const accuracy = correctCount / recent5.length;

  if (accuracy >= 0.8 && currentLevel < 5) {
    return currentLevel + 1;
  } else if (accuracy < 0.4 && currentLevel > 1) {
    return currentLevel - 1;
  }

  return currentLevel;
}

/**
 * Get the mastery level label
 */
export function getMasteryLevelDescription(score: number): {
  label: string;
  color: string;
  progress: number;
} {
  if (score < 40) {
    return { label: "Слабо", color: "bg-red-500", progress: score };
  } else if (score < 70) {
    return { label: "Развивается", color: "bg-yellow-500", progress: score };
  } else if (score < 85) {
    return { label: "Хорошо", color: "bg-blue-500", progress: score };
  } else {
    return { label: "Освоено", color: "bg-green-500", progress: score };
  }
}
