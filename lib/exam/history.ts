import { createHash } from 'node:crypto';
import type { ExamCandidate } from './readiness';

/** Legacy fallback ignores punctuation, spacing, option order and explanatory text.
 * New symbolic generators also supply a canonical operation/input key. */
export function mathematicalStemKey(text: string, latex: string | null = null) {
  const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[−–—]/g, '-')
    .replace(/\s|[.,;:!?«»"$\\{}]/g, '');
  return createHash('sha256').update(normalize(text) + '|' + normalize(latex ?? '')).digest('hex');
}
export interface HistoricalPaper {
  questionIds: string[];
  paper: unknown;
}
export function unusedCandidates(candidates: ExamCandidate[], history: HistoricalPaper[],
  identities: Map<string, { mathKey: string; stemKey: string }>) {
  const ids = new Set<string>(), keys = new Set<string>(), hashes = new Set<string>();
  const familyCounts = new Map<string, number>();
  for (const attempt of history) {
    for (const id of attempt.questionIds) {
      ids.add(id);
      const current = identities.get(id);
      if (current) { keys.add(current.mathKey); if(current.stemKey) keys.add(current.stemKey); }
    }
    if (!Array.isArray(attempt.paper)) continue;
    for (const q of attempt.paper as { id?: string; mathKey?: string; contentHash?: string; family?: string; questionText?: string; latex?: string | null }[]) {
      if (q.id) ids.add(q.id);
      if (q.mathKey) keys.add(q.mathKey);
      if (q.contentHash) hashes.add(q.contentHash);
      if (q.questionText) keys.add(mathematicalStemKey(q.questionText, q.latex));
      if (q.family) familyCounts.set(q.family, (familyCounts.get(q.family) ?? 0) + 1);
    }
  }
  // Input is already shuffled. Stable sorting prefers the least exposed families
  // while retaining randomization between equally exposed ones.
  return candidates.filter(q => !ids.has(q.id) && !hashes.has(q.contentHash) &&
    !keys.has(q.mathKey ?? q.contentHash) && !keys.has(identities.get(q.id)?.stemKey ?? ''))
    .sort((a,b) => (familyCounts.get(a.family) ?? 0) - (familyCounts.get(b.family) ?? 0));
}
