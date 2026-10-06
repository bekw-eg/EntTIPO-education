import { rankPlanSkills } from "../learningPolicy";
import type { RoadNodeSpec, RoadReason, RoadSkillState, SkillGraphEntry } from "./types";

/** Pure, deterministic selection. Consumes existing mastery; never calculates or writes it. */
export function buildLearningRoad(state: readonly RoadSkillState[], graph: readonly SkillGraphEntry[]): RoadNodeSpec[] {
  const available = state.filter(skill => skill.practiceCount > 0);
  const byId = new Map(state.map(skill => [skill.id, skill]));
  const graphById = new Map(graph.map(skill => [skill.id, skill]));
  const ranked = rankPlanSkills(available).map(signal => byId.get(signal.id)!);
  const weak = ranked.filter(skill => skill.state === "weak" || skill.state === "developing");
  const due = ranked.filter(skill => skill.due);
  const coverage = ranked.filter(skill => skill.state === "insufficient").sort((a, b) =>
    Number(graphById.get(b.id)?.coverage) - Number(graphById.get(a.id)?.coverage)
    || b.diagnosticFailures - a.diagnosticFailures || b.observationCount - a.observationCount || a.id.localeCompare(b.id));
  const nodes: RoadNodeSpec[] = [], selected = new Set<string>();
  function addSkill(skill: RoadSkillState, reason: RoadReason, theory = true) {
    if (selected.has(skill.id) || nodes.length >= 6) return;
    selected.add(skill.id);
    const prerequisiteIds = (graphById.get(skill.id)?.prerequisites ?? []).filter(id => {
      const prerequisite = byId.get(id);
      return prerequisite && prerequisite.state !== "good" && prerequisite.state !== "mastered";
    });
    const make = (type: RoadNodeSpec["type"], count: number): RoadNodeSpec => ({
      key: `${type}:${skill.id}`, type, skillId: skill.id, reason, prerequisiteIds: [...prerequisiteIds],
      questionCount: count, estimatedMinutes: count ? Math.max(2, Math.ceil(count * 1.5)) : 2,
    });
    if (theory && nodes.length < 5) nodes.push(make("THEORY", 0));
    nodes.push(make(skill.state === "weak" || skill.state === "developing" ? "REPAIR" : "PRACTICE", Math.min(5, skill.practiceCount)));
  }
  // Up to two weak skills lead the block. An explicitly authored weak prerequisite
  // takes a place before the dependent skill, without making the latter inaccessible.
  for (const skill of weak.slice(0, 2)) {
    const prerequisite = (graphById.get(skill.id)?.prerequisites ?? []).map(id => byId.get(id))
      .find(s => s && s.practiceCount > 0 && (s.state === "weak" || s.state === "developing"));
    if (prerequisite && !selected.size) addSkill(prerequisite, "prerequisite");
    addSkill(skill, "weak");
    if (nodes.length >= 4) break;
  }
  // Reserve a real due review even when weak work fills most of the block.
  if (due[0]) nodes.push({ key: `REVIEW:${due[0].id}`, type: "REVIEW", skillId: due[0].id,
    reason: "due", prerequisiteIds: [], questionCount: 1, estimatedMinutes: 2 });
  if (coverage[0]) addSkill(coverage[0], coverage[0].observationCount ? "evidence" : "coverage");
  for (const skill of coverage.slice(1)) { if (nodes.length >= 5) break; addSkill(skill, "coverage"); }
  for (const skill of ranked.filter(s => s.state !== "mastered")) {
    if (nodes.length >= 5) break;
    addSkill(skill, skill.state === "insufficient" ? "evidence" : skill.state === "weak" || skill.state === "developing"
      ? "weak" : skill.daysSincePractice >= 7 ? "freshness" : "maintenance");
  }
  const focus = nodes.find(node => node.type === "REPAIR" || node.type === "PRACTICE");
  if (focus) nodes.push({ key: `CHECKPOINT:${focus.skillId}`, type: "CHECKPOINT", skillId: focus.skillId,
    reason: "checkpoint", prerequisiteIds: [], questionCount: 1, estimatedMinutes: 2 });
  return nodes;
}

/** Completed nodes, including out-of-order work, can never become CURRENT. */
export function roadStatuses<T extends { completedAt: unknown }>(nodes: readonly T[]) {
  const current = nodes.findIndex(node => !node.completedAt);
  return nodes.map((node, index) => node.completedAt ? "COMPLETED" as const : index === current ? "CURRENT" as const : "UPCOMING" as const);
}
