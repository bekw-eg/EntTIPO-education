import { z } from "zod";
import type { DifficultyBand, ExamProfile } from "./profile";
import type { PracticeChoice } from "../practiceChoice";

// No official mathematics-only deadline exists in 6.1. These are explicitly learning settings.
export const TRAINING_DURATIONS = [30, 40, 120] as const;
export const startExamSchema = z.object({ requestId: z.string().uuid(), profileId: z.string(),
  profileVersion: z.string(), language: z.enum(['ru', 'kk']), durationMinutes: z.union([z.literal(30), z.literal(40), z.literal(120)]) }).strict();
export const saveExamSchema = z.object({ requestId: z.string().uuid(), revision: z.number().int().nonnegative(),
  currentIndex: z.number().int().nonnegative(), answers: z.record(z.number().int().min(0).max(4)).refine((v) => Object.keys(v).length <= 100),
  flaggedQuestionIds: z.array(z.string()).max(100).refine((v) => new Set(v).size === v.length) }).strict();
export const finishExamSchema = z.object({}).strict();

export interface PaperQuestion {
  id: string; contentHash: string; pointCode: string; band: DifficultyBand; family: string;
  topicId: string; topicName: string; skillIds: string[]; skillNames: string[];
  title: string; questionText: string; latex: string | null; options: string[];
  correctIndex: number; explanation: string; difficulty: number; previouslyExposed: boolean;
  // Private A–E snapshot for preparation checks only. Public serializer never exposes it.
  controlChoice?: PracticeChoice;
}
export function publicExamQuestion(q: PaperQuestion) {
  return { id: q.id, pointCode: q.pointCode, band: q.band, title: q.title,
    questionText: q.questionText, latex: q.latex, options: q.options };
}
export function gradeExamQuestion(profile: ExamProfile, q: PaperQuestion, answer: number | undefined) {
  const optionCount = q.controlChoice ? 5 : 4;
  if (profile.official.format !== "single_choice_4" || q.options.length !== optionCount ||
    !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= optionCount) throw new Error("Unsupported exam format");
  if (answer !== undefined && (!Number.isInteger(answer) || answer < 0 || answer >= optionCount)) throw new Error("Invalid exam answer");
  const isCorrect = answer === q.correctIndex;
  return { ...publicExamQuestion(q), topicId: q.topicId, topicName: q.topicName, skillIds: q.skillIds,
    answer: answer ?? null, skipped: answer === undefined, isCorrect,
    points: isCorrect ? profile.official.correctPoints : profile.official.incorrectPoints,
    maxPoints: profile.official.correctPoints, correctIndex: q.correctIndex, explanation: q.explanation };
}
export function remainingSeconds(deadline: Date, serverNow: Date) {
  return Math.max(0, Math.ceil((deadline.getTime() - serverNow.getTime()) / 1000));
}
