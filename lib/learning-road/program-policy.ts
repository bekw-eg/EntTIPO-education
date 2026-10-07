/** Product heuristics, not a calibrated prediction of an official exam score.
 * Persisted in each cycle so deployment does not change a student's active criteria. */
export const PREPARATION_POLICY = {
  version: 1, blockSize: 4, minimumIndependentCorrect: 3, passRatio: 0.75,
  mixedEvery: 3, mixedPerSkill: 2, priorSkillsInMixed: 1,
  practicePerSkill: 3, finalPassRatio: 0.8, finalMinutes: 40,
} as const;
export type PreparationPolicy = { [K in keyof typeof PREPARATION_POLICY]: number };

export type EvidenceAnswer = { skillIds: string[]; isCorrect: boolean; independent: boolean };
export function assessSkills(answers: EvidenceAnswer[], skillIds: string[], kind: "SKILL" | "MIXED",
  policy: PreparationPolicy = PREPARATION_POLICY) {
  const skills = skillIds.map(skillId => {
    const related = answers.filter(a => a.skillIds.includes(skillId));
    const correct = related.filter(a => a.isCorrect && a.independent).length;
    const required = kind === "SKILL" ? policy.blockSize : policy.mixedPerSkill;
    const minimum = kind === "SKILL" ? policy.minimumIndependentCorrect : policy.mixedPerSkill;
    return { skillId, correct, total: related.length,
      passed: related.length >= required && correct >= minimum && correct / related.length >= policy.passRatio };
  });
  return { passed: skills.length > 0 && skills.every(s => s.passed), skills,
    gapSkillIds: skills.filter(s => !s.passed).map(s => s.skillId) };
}

export type ProgramSkill = { id: string; state: string; due: boolean; failures: number };
/** Stable topological order. Unknown/unobserved is distinct from weak. Cycles are content errors. */
export function orderProgramSkills(skills: ProgramSkill[], graph: Readonly<Record<string, readonly string[]>>) {
  const available = new Map(skills.map(s => [s.id, s]));
  const rank = (s: ProgramSkill) => s.due ? 0 : s.state === "weak" || s.failures > 0 ? 1 : s.state === "developing" ? 2 : s.state === "insufficient" ? 3 : 4;
  const sorted = [...skills].sort((a, b) => rank(a) - rank(b) || b.failures - a.failures || a.id.localeCompare(b.id));
  const visited = new Set<string>(), visiting = new Set<string>(), result: ProgramSkill[] = [];
  function visit(skill: ProgramSkill) {
    if (visited.has(skill.id)) return;
    if (visiting.has(skill.id)) throw new Error("Cyclic preparation prerequisites");
    visiting.add(skill.id);
    for (const id of graph[skill.id] ?? []) { const dependency = available.get(id); if (dependency) visit(dependency); }
    visiting.delete(skill.id); visited.add(skill.id); result.push(skill);
  }
  sorted.forEach(visit);
  return result;
}
