export type OfflineLanguage = "ru" | "kk";
export type Answers = Record<string, string>;
export interface OfflineStep {
  id: string; type: string; prompt: string;
  options: { id: string; text: string }[];
  // This is an explicit assisted mode. Keys are readable by the device owner.
  localKey?: { kind: "choice" | "number" | "select"; value: string };
}
export interface OfflineQuestion {
  id: string; title: string; text: string; latex: string | null; steps: OfflineStep[];
}
export interface OfflineContent {
  format: 1; topicIds: string[]; title: string; language: OfflineLanguage;
  rules: { id: string; title: string; text: string }[];
  materials: { title: string; text: string; latex?: string | null }[];
  questions: OfflineQuestion[];
}
export interface OfflinePackage extends OfflineContent {
  id: string; userId: string; sessionId: string; contentVersion: string;
  downloadedAt: string; assetsVersion: string; bytes: number; assetBytes: number;
  assets: import("./assets").AssetManifest;
}
export type LocalVerdict = "correct" | "incorrect" | "pending";
export interface OfflineWork {
  userId: string; sessionId: string; packageId: string; currentIndex: number;
  answers: Record<string, Answers>; revision: number; localRevision: number;
  acceptedVersion?: string; reconcile?: boolean;
  blocked?: "auth" | "conflict" | "stale" | "error";
  message?: string;
}
export interface OfflineSend {
  submissionId: string; userId: string; sessionId: string; packageId: string;
  questionId: string; sequence: number; contentVersion: string;
  stepAnswers: { stepId: string; answer: string }[]; timeSpent: number; usedHint: true;
}
export interface QueueEntry extends OfflineSend {
  local: Record<string, LocalVerdict>; createdAt: number;
  receipt?: { submissionId: string; revision: number; result: {
    isCorrect: boolean; score: number; stepResults: { stepId: string; isCorrect: boolean; expectedAnswer: string }[];
    explanation?: string; explanationKk?: string | null;
  } };
}
export interface OfflineAccount { userId: string; name: string; requiresLogin?: boolean }
