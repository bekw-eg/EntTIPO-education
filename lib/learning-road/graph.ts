import { TIPO_MATH } from "../exam/profile";
import type { SkillGraphEntry } from "./types";

/** Authored curriculum recommendations. Absence of an edge means no dependency claim.
 * These edges suggest preparation; they never diagnose the cause of an error or lock a topic. */
export const SKILL_PREREQUISITES: Readonly<Record<string, readonly string[]>> = {
  chain_rule: ["exam_derivative_rules"],
  exam_tangent_equation: ["exam_derivative_rules"],
  exam_irrational_transformations: ["exam_nth_roots"],
  exam_power_exponential_integral: ["exam_indefinite_integral", "power_properties"],
  exam_separable_ode: ["exam_indefinite_integral"],
};
const coverage = new Set(TIPO_MATH.points.flatMap(point => point.skills));
export function skillGraph(skillIds: readonly string[]): SkillGraphEntry[] {
  const available = new Set(skillIds);
  return [...skillIds].sort().map(id => ({ id, coverage: coverage.has(id),
    prerequisites: (SKILL_PREREQUISITES[id] ?? []).filter(prerequisite => available.has(prerequisite)) }));
}
