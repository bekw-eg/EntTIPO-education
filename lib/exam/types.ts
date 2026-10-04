import type { DifficultyBand, MatchQuality } from "./profile";
export interface BankQuestion {
  id: string; topicId: string; title: string; questionText: string; latex: string | null;
  correctAnswer: string; answerType: string; explanation: string; difficulty: number; purpose: string;
  skills: { skillId: string }[];
  steps: { order: number; type: string; prompt: string; expectedAnswer: string;
    options: { order: number; text: string; isCorrect: boolean }[] }[];
}
export interface ContentReview {
  questionId: string; contentHash: string; profileId: string; profileVersion: string;
  pointCode: string | null; quality: MatchQuality; rationale: string;
  family: string; band: DifficultyBand | null; reviewedAt: string; skillIds: string[];
}
