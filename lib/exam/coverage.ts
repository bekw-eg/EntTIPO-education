import { CONTENT_REVIEWS, validateReviewReferences } from "./reviews";
import { questionFingerprint, examFormat } from "./fingerprint";
import { assessExamReadiness, type ExamCandidate } from "./readiness";
import { validateExamProfile, type ExamProfile, type MatchQuality } from "./profile";
import type { BankQuestion, ContentReview } from "./types";

export function auditCoverage(profile: ExamProfile, bank: BankQuestion[], reviews: ContentReview[] = CONTENT_REVIEWS) {
  validateExamProfile(profile);
  validateReviewReferences(reviews);
  if (new Set(bank.map((q) => q.id)).size !== bank.length) throw new Error("Duplicate question IDs in bank snapshot");
  const selected = reviews.filter((r) => r.profileId === profile.id && r.profileVersion === profile.version);
  const byHash = new Map(selected.map((r) => [r.contentHash, r]));
  const byId = new Map(selected.map((r) => [r.questionId, r]));
  const candidates: ExamCandidate[] = [];
  const questions = bank.map((q) => {
    const hash = questionFingerprint(q), known = byId.get(q.id), reviewed = byHash.get(hash);
    // A changed known question cannot inherit approval from its old review.
    const stale = !!known && known.contentHash !== hash;
    const r = stale ? undefined : reviewed;
    const quality: MatchQuality = r?.quality ?? "needs_review";
    const format = examFormat(q);
    const missingSkills = (r?.skillIds ?? []).filter((s) => !q.skills.some((link) => link.skillId === s));
    const eligible = quality === "direct" && format === profile.official.format && !!r?.band &&
      q.purpose === "practice" && missingSkills.length === 0;
    if (eligible) candidates.push({ id: q.id, contentHash: hash, pointCode: r!.pointCode!, band: r!.band!, family: r!.family });
    return { id: q.id, title: q.title, questionText: q.questionText, latex: q.latex, topicId: q.topicId, pointCode: r?.pointCode ?? known?.pointCode ?? null,
      quality, rationale: r?.rationale ?? (stale ? "Содержание изменилось после проверки; требуется новая проверка." : "Нет проверки текущего содержания для этого профиля."),
      format, band: r?.band ?? null, platformDifficulty: q.difficulty, family: r?.family ?? null, contentHash: hash,
      reviewedAt: r?.reviewedAt ?? null,
      skillIds: q.skills.map((s) => s.skillId), missingSkills, eligible,
      topicMismatch: !!r?.pointCode && q.topicId !== profile.points.find((p) => p.code === r.pointCode)?.topicId };
  });
  const points = profile.points.map((point) => {
    const qs = questions.filter((q) => q.pointCode === point.code);
    const direct = qs.filter((q) => q.quality === "direct");
    const families = new Set(direct.map((q) => q.family));
    const exam = direct.filter((q) => q.eligible);
    return { ...point, total: qs.length, direct: direct.length, supporting: qs.filter((q) => q.quality === "supporting").length,
      needsReview: qs.filter((q) => q.quality === "needs_review").length,
      distinctContent: new Set(direct.map((q) => q.contentHash)).size, families: families.size,
      examEligible: exam.length, examFamilies: new Set(exam.map((q) => q.family)).size,
      missingFormat: exam.length === 0,
      difficulty: { A: exam.filter((q) => q.band === "A").length, B: exam.filter((q) => q.band === "B").length, C: exam.filter((q) => q.band === "C").length },
      status: direct.length === 0 ? "uncovered" : families.size < profile.platformPolicy.minFamiliesPerPoint ? "thin" : "represented",
      // Represented is presence/diversity evidence, never a claim of exhaustive subskill coverage.
      questionIds: qs.map((q) => q.id) };
  });
  const duplicateGroups = [...new Set(questions.map((q) => q.contentHash))].map((hash) =>
    questions.filter((q) => q.contentHash === hash).map((q) => q.id)).filter((ids) => ids.length > 1);
  const totals = { databaseQuestions: bank.length, direct: questions.filter((q) => q.quality === "direct").length,
    supporting: questions.filter((q) => q.quality === "supporting").length,
    outside: questions.filter((q) => q.quality === "outside").length,
    needsReview: questions.filter((q) => q.quality === "needs_review").length,
    eligible: candidates.length, uniqueEligible: new Set(candidates.map((q) => q.contentHash)).size,
    topicMismatches: questions.filter((q) => q.topicMismatch).length,
    uncoveredPoints: points.filter((p) => p.status === "uncovered").length,
    missingFormatPoints: points.filter((p) => p.missingFormat).length };
  const sections = [...new Set(points.map((p) => p.section))].map((section) => {
    const children = points.filter((p) => p.section === section);
    return { section, pointCodes: children.map((p) => p.code), direct: children.reduce((n, p) => n + p.direct, 0),
      uncoveredPoints: children.filter((p) => p.status === "uncovered").length,
      status: children.every((p) => p.status === "uncovered") ? "uncovered" : children.some((p) => p.status === "uncovered") ? "partial" : "represented" };
  });
  return { profile, totals, sections, points, questions, duplicateGroups,
    readiness: { oneVariant: assessExamReadiness(profile, candidates),
      multipleVariants: assessExamReadiness(profile, candidates, profile.platformPolicy.requestedVariants),
      balancedVariant: assessExamReadiness(profile, candidates, 1, true) } };
}

export type CoverageReport = ReturnType<typeof auditCoverage>;
