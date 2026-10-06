import type { SkillState } from "../skillMastery";

export type RoadNodeType = "THEORY" | "PRACTICE" | "REPAIR" | "REVIEW" | "CHECKPOINT";
export type RoadStatus = "COMPLETED" | "CURRENT" | "UPCOMING";
export type RoadReason = "weak" | "due" | "coverage" | "evidence" | "prerequisite" | "checkpoint" | "freshness" | "maintenance";
export interface RoadSkillState {
  id: string; state: SkillState; masteryScore: number; distinctQuestions: number;
  observationCount: number; daysSincePractice: number; recentMistakes: number;
  diagnosticFailures: number; hints: number; due: boolean; practiceCount: number;
}
export interface SkillGraphEntry { id: string; prerequisites: readonly string[]; coverage: boolean }
export interface RoadNodeSpec {
  key: string; type: RoadNodeType; skillId: string; reason: RoadReason;
  prerequisiteIds: string[]; questionCount: number; estimatedMinutes: number;
}
export interface RoadNodeView extends RoadNodeSpec {
  id: string; status: RoadStatus; nameRu: string; nameKk: string; masteryScore: number | null;
  distinctQuestions: number; sessionId: string | null; unavailable: boolean; skipped: boolean;
  outcome: string | null; prerequisites: { id: string; nameRu: string; nameKk: string }[];
}
export interface LearningRoadView {
  id: string | null; sequence: number; nodes: RoadNodeView[]; completedCount: number;
  needsDiagnostic: boolean; finished: boolean;
}
