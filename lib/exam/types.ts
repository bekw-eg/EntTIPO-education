import type { DifficultyBand, MatchQuality } from "./profile";
export interface BankQuestion {
  id: string; topicId: string; title: string; questionText: string; latex: string | null;
  correctAnswer: string; answerType: string; explanation: string; difficulty: number; purpose: string;
  titleKk?: string | null; questionTextKk?: string | null; explanationKk?: string | null; localizationSource?: string | null;
  skills: { skillId: string }[];
  steps: { order: number; type: string; prompt: string; promptKk?: string | null; hint?: string | null; hintKk?: string | null; expectedAnswer: string;
    options: { order: number; text: string; textKk?: string | null; isCorrect: boolean }[] }[];
}
export interface ContentReview {
  questionId: string; contentHash: string; profileId: string; profileVersion: string;
  pointCode: string | null; quality: MatchQuality; rationale: string;
  family: string; band: DifficultyBand | null; reviewedAt: string; skillIds: string[];
}
