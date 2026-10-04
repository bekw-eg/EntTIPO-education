import { calculateMasteryScore } from "./mastery";

export interface SkillObservationData {
  questionId: string; createdAt: Date; score: number; isCorrect: boolean; isPartial: boolean;
  usedHint: boolean; difficulty: number; attemptNumber: number;
}
export type SkillState = "insufficient" | "weak" | "developing" | "good" | "mastered";

/** Replay the same mastery algorithm as topics. Age and evidence gate the label. */
export function calculateSkillProgress(observations: SkillObservationData[], now = new Date()) {
  const chronological = [...observations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let masteryScore = 0;
  for (let index = 0; index < chronological.length; index++) {
    const date = chronological[index].createdAt.getTime();
    if (index > 0) {
      const gapDays = Math.max(0, (date - chronological[index - 1].createdAt.getTime()) / 86400000);
      masteryScore *= Math.pow(0.5, gapDays / 90);
    }
    const recentWindow = chronological.slice(Math.max(0, index - 9), index + 1)
      .filter((o) => date - o.createdAt.getTime() <= 90 * 86400000);
    masteryScore = calculateMasteryScore(recentWindow, masteryScore);
  }
  const recent = chronological.filter((o) => now.getTime() - o.createdAt.getTime() <= 90 * 86400000);
  const distinctQuestions = new Set(recent.map((o) => o.questionId)).size;
  const independentCorrect = new Set(recent.filter((o) => o.isCorrect && !o.usedHint && o.attemptNumber === 1).map((o) => o.questionId)).size;
  const lastAttemptAt = chronological.at(-1)?.createdAt ?? null;
  const ageDays = lastAttemptAt ? Math.max(0, (now.getTime() - lastAttemptAt.getTime()) / 86400000) : 0;
  masteryScore = Math.round(masteryScore * Math.pow(0.5, ageDays / 90));
  let state: SkillState = distinctQuestions < 3 ? "insufficient" : masteryScore < 40 ? "weak" : masteryScore < 70 ? "developing" : "good";
  if (state !== "insufficient" && masteryScore >= 85 && distinctQuestions >= 5 && independentCorrect >= 4) state = "mastered";
  return { masteryScore, state, observationCount: observations.length, distinctQuestions, lastAttemptAt };
}

/** Score each mapped skill only on steps that actually test it. */
export function skillOutcomes(steps: { id: string; skills: { skillId: string }[] }[], results: { stepId: string; isCorrect: boolean }[]) {
  const grouped = new Map<string, boolean[]>();
  for (const result of results) {
    const step = steps.find((s) => s.id === result.stepId);
    for (const { skillId } of step?.skills ?? []) {
      grouped.set(skillId, [...(grouped.get(skillId) ?? []), result.isCorrect]);
    }
  }
  return [...grouped].map(([skillId, answers]) => {
    const correct = answers.filter(Boolean).length;
    return { skillId, score: Math.round(100 * correct / answers.length), isCorrect: correct === answers.length,
      isPartial: correct > 0 && correct < answers.length };
  });
}
