import type { DifficultyBand, ExamProfile } from "./profile";

export interface ExamCandidate { id: string; pointCode: string; band: DifficultyBand; family: string; contentHash: string }

/** Capacity check for a future generator. Never fills a gap with an unreviewed task or reuses a family.
 * Difficulty quotas are official; one task per content point is an optional platform blueprint.
 * Integral max-flow prevents greedy choices and double counting across topic/difficulty requirements.
 */
export function assessExamReadiness(profile: ExamProfile, candidates: ExamCandidate[], variants = 1, balanced = false) {
  if (!Number.isInteger(variants) || variants < 1 || variants > 10) throw new Error("Variants must be 1..10");
  const unique = [...new Map(candidates.map((q) => [q.contentHash, q])).values()];
  const bands: DifficultyBand[] = ["A", "B", "C"];
  if (unique.some((q) => !profile.points.some((p) => p.code === q.pointCode) || !bands.includes(q.band))) throw new Error("Invalid exam candidate");
  const families = [...new Set(unique.map((q) => q.family))];
  // A reviewed family belongs to one primary specification point.
  for (const family of families) if (new Set(unique.filter((q) => q.family === family).map((q) => q.pointCode)).size !== 1) throw new Error("A family cannot cover two points");
  const edges = new Map<string, Map<string, number>>();
  function add(a: string, b: string, n: number) {
    if (!edges.has(a)) edges.set(a, new Map());
    if (!edges.has(b)) edges.set(b, new Map());
    edges.get(a)!.set(b, n); edges.get(b)!.set(a, 0);
  }
  for (const point of profile.points) add("source", `point:${point.code}`, balanced ? variants : profile.official.questionCount * variants);
  for (const family of families) {
    const qs = unique.filter((q) => q.family === family);
    add(`point:${qs[0].pointCode}`, `family:${family}`, 1);
    for (const band of new Set(qs.map((q) => q.band))) add(`family:${family}`, `band:${band}`, 1);
  }
  for (const band of bands) add(`band:${band}`, "sink", profile.official.difficultyCounts[band] * variants);
  let matched = 0;
  for (;;) {
    const parent = new Map<string, string>(), queue = ["source"];
    for (let i = 0; i < queue.length && !parent.has("sink"); i++) {
      for (const [next, capacity] of edges.get(queue[i]) ?? []) {
        if (capacity > 0 && next !== "source" && !parent.has(next)) { parent.set(next, queue[i]); queue.push(next); }
      }
    }
    if (!parent.has("sink")) break;
    for (let at = "sink"; at !== "source";) {
      const prev = parent.get(at)!;
      edges.get(prev)!.set(at, edges.get(prev)!.get(at)! - 1);
      edges.get(at)!.set(prev, edges.get(at)!.get(prev)! + 1); at = prev;
    }
    matched++;
  }
  const required = profile.official.questionCount * variants;
  const selectedQuestionIds = families.flatMap((family) => bands.flatMap((band) =>
    (edges.get(`band:${band}`)?.get(`family:${family}`) ?? 0) > 0
      ? [unique.find((q) => q.family === family && q.band === band)!.id] : []));
  const difficulty = bands.map((band) => ({ band, required: profile.official.difficultyCounts[band] * variants,
    availableFamilies: new Set(unique.filter((q) => q.band === band).map((q) => q.family)).size,
    missingInPlan: edges.get(`band:${band}`)!.get("sink")! }));
  const points = balanced ? profile.points.map((p) => ({ pointCode: p.code, required: variants,
    availableFamilies: new Set(unique.filter((q) => q.pointCode === p.code).map((q) => q.family)).size,
    missingInPlan: edges.get("source")!.get(`point:${p.code}`)! })) : [];
  return { variants, balanced, canGenerate: matched === required, required, matched, shortage: required - matched, selectedQuestionIds,
    independentFamilies: families.length, difficulty, points,
    constraints: balanced ? "Квоты A/B/C НЦТ + внутренняя квота: один на каждый пункт; семейства не повторяются между вариантами." :
      "Квоты формата и A/B/C НЦТ; без тематических квот. Семейства не повторяются между вариантами — внутренняя политика." };
}
