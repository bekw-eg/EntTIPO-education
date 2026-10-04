export const DEFAULT_TIME_ZONE = "Asia/Qyzylorda";
// Internal pedagogical heuristic, not a validated optimal learning method.
export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;

export function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; }
  catch { return false; }
}
export function studentTimeZone(value?: string | null): string {
  return value && validTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
export function localDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
/** First instant of a calendar day, also for 23/25-hour days and skipped midnight. */
export function dayStart(day: string, timeZone: string): Date {
  const center = Date.parse(`${day}T12:00:00Z`);
  let lo = center - 36 * 3600000, hi = center + 36 * 3600000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDay(new Date(mid), timeZone) < day) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}
export function dayBounds(now: Date, timeZone: string) {
  const day = localDay(now, timeZone);
  return { day, gte: dayStart(day, timeZone), lt: dayStart(addDays(day, 1), timeZone) };
}
export function nextReview(now: Date, timeZone: string, previousIndex: number, success: boolean, initial = false) {
  const intervalIndex = success && !initial ? Math.min(previousIndex + 1, REVIEW_INTERVALS.length - 1) : 0;
  return { intervalIndex, dueDay: addDays(localDay(now, timeZone), REVIEW_INTERVALS[intervalIndex]), timeZone };
}

export interface PlanSignal {
  id: string; state: string; masteryScore: number; due: boolean; recentMistakes: number;
  diagnosticFailures: number; hints: number; daysSincePractice: number;
}
export function rankPlanSkills(signals: PlanSignal[]) {
  return signals.map((s) => {
    const reasons = [
      ...(s.due ? ["due"] : []), ...(s.recentMistakes ? ["recent_error"] : []),
      ...(s.state === "weak" ? ["weak"] : []), ...(s.diagnosticFailures ? ["diagnostic_gap"] : []),
      ...(s.hints ? ["hints"] : []), ...(s.daysSincePractice >= 7 ? ["spaced"] : []),
    ];
    const weight = Number(s.due) * 200 + Math.min(s.recentMistakes, 3) * 30 + Number(s.state === "weak") * 80
      + Math.min(s.diagnosticFailures, 3) * 20 + Math.min(s.hints, 3) * 12
      + Math.min(s.daysSincePractice, 30) + (100 - s.masteryScore) / 10;
    return { ...s, reasons: reasons.length ? reasons : ["maintenance"], weight };
  }).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

export function independentCheck(data: {
  isCorrect: boolean; usedHint: boolean; priorAttempts: number; priorHelp: boolean;
  questionId: string; originalQuestionId?: string | null; testsSkill: boolean; difficulty: number; targetDifficulty: number;
}) {
  return data.isCorrect && !data.usedHint && !data.priorHelp && data.priorAttempts === 0
    && data.questionId !== data.originalQuestionId && data.testsSkill
    && Math.abs(data.difficulty - data.targetDifficulty) <= 1;
}
