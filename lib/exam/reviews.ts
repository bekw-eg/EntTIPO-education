import legacy from "./legacy-reviews.json";
import { EXAM_EXERCISES, exerciseReview } from "./bank";
import { EXAM_PROFILES } from "./profile";
import type { ContentReview } from "./types";
import { SUPPORTING_EXERCISES } from './generated-bank';

export const CONTENT_REVIEWS: ContentReview[] = [...legacy as ContentReview[], ...EXAM_EXERCISES.map(exerciseReview),
  ...SUPPORTING_EXERCISES.map(q=>({ ...exerciseReview(q), quality:'supporting' as const,
    rationale:'Ответы проверены SymPy, но вычисление отдельного значения функции недостаточно проверяет свойства и график. В экзамен не допускается.' }))];
export function validateReviewReferences(reviews = CONTENT_REVIEWS) {
  const hashes = new Set<string>(), ids = new Set<string>();
  for (const r of reviews) {
    const profile = EXAM_PROFILES.find((p) => p.id === r.profileId && p.version === r.profileVersion);
    if (!profile) throw new Error(`Unknown profile/version: ${r.profileId}@${r.profileVersion}`);
    const point = profile.points.find((p) => p.code === r.pointCode);
    if (r.pointCode !== null && !point) throw new Error(`Invalid specification point: ${r.questionId}/${r.pointCode}`);
    if ((r.quality === "direct" || r.quality === "supporting") && !point) throw new Error(`Missing point: ${r.questionId}`);
    if ((r.quality === "direct" && !r.skillIds.length) || r.skillIds.some((s) => !point?.skills.includes(s))) throw new Error(`Invalid point skill: ${r.questionId}`);
    if (!["direct", "supporting", "outside", "needs_review"].includes(r.quality) ||
      (r.band !== null && !["A", "B", "C"].includes(r.band))) throw new Error(`Invalid review classification: ${r.questionId}`);
    if (!r.family || !r.rationale || !/^[a-f0-9]{64}$/.test(r.contentHash) || !/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt)) throw new Error(`Incomplete review: ${r.questionId}`);
    const prefix = `${r.profileId}@${r.profileVersion}/`, hash = prefix + r.contentHash, id = prefix + r.questionId;
    if (hashes.has(hash) || ids.has(id)) throw new Error(`Duplicate content review: ${r.questionId}`);
    hashes.add(hash); ids.add(id);
  }
}
