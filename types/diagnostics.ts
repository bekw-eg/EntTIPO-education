import type { PracticeQuestion, StepResult } from "./index";
import type { SkillState } from "../lib/skillMastery";

export interface SkillRecommendation {
  id: string; title: string; titleKk: string | null; questionText: string; questionTextKk: string | null; difficulty: number;
  latex?: string | null;
}
export interface SkillProgressView {
  id: string; topicId: string; nameRu: string; nameKk: string; explanationRu: string; explanationKk: string;
  ruleRu: string; ruleKk: string; masteryScore: number; state: SkillState; observationCount: number;
  distinctQuestions: number; lastAttemptAt: string | null; recommendation: SkillRecommendation | null;
}
export interface DiagnosticSkillResult extends SkillProgressView {
  assessment: "insufficient" | "gap_observed" | "no_gap_observed";
  evidence: (StepResult & { questionId: string; questionText: string; questionTextKk: string | null;
    explanation: string; explanationKk: string | null })[];
}
export interface DiagnosticReport { skills: DiagnosticSkillResult[]; correctCount: number; totalCount: number }
export interface DiagnosticSnapshot {
  id: string; status: "active" | "completed"; questionIds: string[]; currentIndex: number;
  totalCount: number; completedCount: number; revision: number; draftAnswers: Record<string, string>;
  question: PracticeQuestion | null; result: DiagnosticReport | null;
  answers: { questionId: string; stepAnswers: { stepId: string; answer: string }[] }[];
}
