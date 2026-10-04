import { exercise, SkillExercise, SkillId, SKILLS } from "./skillCatalog";

// Authored variants: verification-only exercises are reserved from ordinary practice.
// Exposed answers are never recycled as independent evidence.
const variants: Record<SkillId, [string, string][]> = {
  power_properties: [
    ["x^5 · x^6 (x > 0)", "x^11"], ["(x^4)^3", "x^12"], ["x^11 / x^5 (x ≠ 0)", "x^6"],
    ["(x^2)^3 · x^4 (x > 0)", "x^10"], ["x^6 · x^2 (x > 0)", "x^8"], ["(x^5)^3", "x^15"],
    ["x^12 / x^5 (x ≠ 0)", "x^7"], ["(x^3)^2 · x^5 (x > 0)", "x^11"],
    ["x^8 / x^3 (x ≠ 0)", "x^5"], ["(x^2)^5", "x^10"],
  ],
  bracket_signs: [
    ["−(2*x+5)", "-2*x-5"], ["−(4*x−9)", "-4*x+9"], ["−5*(x−2)", "-5*x+10"],
    ["−(2*x+3)−(x−4)", "-3*x+1"], ["−(3*x+4)", "-3*x-4"], ["−(5*x−6)", "-5*x+6"],
    ["−2*(3*x−5)", "-6*x+10"], ["−(4*x+2)−(2*x−7)", "-6*x+5"],
    ["−(6*x−1)", "-6*x+1"], ["−3*(2*x−4)", "-6*x+12"],
  ],
  chain_rule: [
    ["(4*x+1)^2", "8*(4*x+1)"], ["(1-2*x)^3", "-6*(1-2*x)^2"], ["(x^2+3)^2", "4*x*(x^2+3)"],
    ["(2*x^2+1)^3", "12*x*(2*x^2+1)^2"], ["(5*x+2)^2", "10*(5*x+2)"], ["(3-4*x)^3", "-12*(3-4*x)^2"],
    ["(x^2+4)^2", "4*x*(x^2+4)"], ["(3*x^2+2)^3", "18*x*(3*x^2+2)^2"],
    ["(6*x+5)^2", "12*(6*x+5)"], ["(4-5*x)^3", "-15*(4-5*x)^2"],
  ],
};
export const DAILY_EXERCISES: SkillExercise[] = Object.entries(variants).flatMap(([skillId, rows]) => rows.map(([expression, answer], index) => {
  const skill = SKILLS.find((s) => s.id === skillId)!;
  return { ...exercise(`daily_${skillId}_${index + 1}`, skillId as SkillId, expression, answer,
    `${skill.ruleRu} Ответ: ${answer}.`, `${skill.ruleKk} Жауап: ${answer}.`, [], index < 4 ? "practice" : "verification"),
    difficulty: index === 3 || index === 7 ? 2 : 1 };
}));
