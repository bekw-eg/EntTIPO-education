import records from './verified-bank.json';
import type { ExamExercise } from './bank';
import { createHash } from 'node:crypto';

function matchesCertificate(q: typeof records[number]) {
  // Keep the JSON field order identical to the independent verifier's digest.
  return q.verification.contentDigest === createHash('sha256').update(JSON.stringify([
    q.id,q.pointCode,q.band,q.family,q.text,q.textKk,q.options,q.correctIndex,q.explanation,q.explanationKk,q.mathKey,q.oracle,q.verification.result])).digest('hex'); }
export function hasVerifiedContent(q: typeof records[number]) { return q.verification.result === 'passed' &&
  matchesCertificate(q); }
export const VERIFIED_EXERCISES = records.filter(hasVerifiedContent) as unknown as (ExamExercise & {
  textKk: string; explanationKk: string; mathKey: string; source: string;
  verification: { method: string; engine: string; checkedAt: string; result: string; normalizedAnswer: string; domainChecked: boolean };
})[];
export const VERIFIED_BY_ID = new Map(VERIFIED_EXERCISES.map(q => [q.id, q]));
export const SUPPORTING_EXERCISES = records.filter(q=>q.verification.result==='supporting'&&matchesCertificate(q)) as unknown as ExamExercise[];
// Withdrawn aliases retain their mathematical identity for pre-upgrade history.
export const GENERATED_IDENTITIES = new Map(records.filter(matchesCertificate).map(q=>[q.id,q]));
// Reviewed cross-version equivalences: the old wording/units hide the same
// operation and data. Keep these aliases even when a generated row is withdrawn.
export const LEGACY_MATH_ALIASES = new Map([
  ['exam_v1_root_absolute','exam_v2_06_absolute_005'],
  ['exam_v1_cylinder_net','exam_v2_17_net_002'],
  ['exam_v1_cone_sector','exam_v2_18_sector_004'],
  ['exam_v1_cylinder_volume','exam_v2_20_cylinder_001'],
].map(([id,target])=>[id,GENERATED_IDENTITIES.get(target)!.mathKey]));
