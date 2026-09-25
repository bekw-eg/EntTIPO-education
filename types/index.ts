// =============================================================================
// ENT TIPO — Core TypeScript Types
// =============================================================================

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Topic & Subtopic ────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  name: string;
  description: string;
  difficulty: number; // 1-5
  order: number;
  createdAt: Date;
}

export interface Subtopic {
  id: string;
  topicId: string;
  name: string;
  description: string | null;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  whatIsIt: string;
  whenUsed: string;
  formula: string | null;
  formulaLatex: string | null;
  example: string;
  commonErrors: string;
  createdAt: Date;
}

// ─── Questions & Steps ───────────────────────────────────────────────────────

export type StepType =
  | "multiple_choice"
  | "multiple_select"
  | "numeric_input"
  | "expression_input";

export type AnswerType = "expression" | "number" | "multiple_choice";

export interface QuestionOption {
  id: string;
  stepId: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface QuestionStep {
  id: string;
  questionId: string;
  order: number;
  type: StepType;
  prompt: string;
  expectedAnswer: string;
  hint: string | null;
  options: QuestionOption[];
}

export interface Question {
  id: string;
  topicId: string;
  subtopicId: string | null;
  title: string;
  questionText: string;
  latex: string | null;
  difficulty: number; // 1-5
  correctAnswer: string;
  answerType: AnswerType;
  explanation: string;
  createdAt: Date;
  topic: Topic;
  subtopic: Subtopic | null;
  steps: QuestionStep[];
}

// ─── Practice Session ────────────────────────────────────────────────────────

export type SessionMode =
  | "mixed"
  | "weak_topics"
  | "specific_topic"
  | "review_mistakes";

export type SessionStatus = "active" | "completed";

export interface PracticeSession {
  id: string;
  userId: string;
  mode: SessionMode;
  totalCount: number;
  completedCount: number;
  correctCount: number;
  topicId: string | null;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
}

// ─── Attempts & Answers ───────────────────────────────────────────────────────

export interface UserStepAnswer {
  id: string;
  attemptId: string;
  stepId: string;
  answer: string;
  isCorrect: boolean;
  createdAt: Date;
}

export interface UserAttempt {
  id: string;
  userId: string;
  questionId: string;
  sessionId: string;
  isCorrect: boolean;
  isPartial: boolean;
  score: number;
  usedHint: boolean;
  timeSpent: number;
  attemptNumber: number;
  createdAt: Date;
  stepAnswers: UserStepAnswer[];
  question: Question;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export type MasteryLevel = "weak" | "developing" | "good" | "mastered";

export interface UserTopicProgress {
  id: string;
  userId: string;
  topicId: string;
  masteryScore: number; // 0-100
  currentLevel: number; // 1-5 (question difficulty to give)
  totalAttempts: number;
  correctAttempts: number;
  lastAttemptAt: Date | null;
  updatedAt: Date;
  topic: Topic;
}

export function getMasteryLevel(score: number): MasteryLevel {
  if (score < 40) return "weak";
  if (score < 70) return "developing";
  if (score < 85) return "good";
  return "mastered";
}

export function getMasteryColor(score: number): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "weak":
      return "text-red-500";
    case "developing":
      return "text-yellow-500";
    case "good":
      return "text-blue-500";
    case "mastered":
      return "text-green-500";
  }
}

export function getMasteryBadgeColor(score: number): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "weak":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "developing":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "good":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "mastered":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  }
}

export function getMasteryLabel(score: number): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "weak":
      return "Слабо";
    case "developing":
      return "Развивается";
    case "good":
      return "Хорошо";
    case "mastered":
      return "Освоено";
  }
}

// ─── Mistakes ────────────────────────────────────────────────────────────────

export type ErrorType =
  | "wrong_formula"
  | "calculation_error"
  | "sign_error"
  | "algebra_error"
  | "domain_error"
  | "concept_error"
  | "incorrect_method";

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  wrong_formula: "Неверная формула",
  calculation_error: "Ошибка вычисления",
  sign_error: "Ошибка знака",
  algebra_error: "Алгебраическая ошибка",
  domain_error: "Область определения",
  concept_error: "Концептуальная ошибка",
  incorrect_method: "Неверный метод",
};

export interface Mistake {
  id: string;
  userId: string;
  questionId: string;
  attemptId: string;
  topicId: string;
  subtopicId: string | null;
  errorType: ErrorType;
  description: string | null;
  isReviewed: boolean;
  reviewedAt: Date | null;
  createdAt: Date;
  question: Question;
  topic: Topic;
}

// ─── Daily Goal ───────────────────────────────────────────────────────────────

export interface DailyGoal {
  id: string;
  userId: string;
  date: Date;
  targetCount: number;
  completedCount: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSolved: number;
  todaySolved: number;
  todayTarget: number;
  overallAccuracy: number;
  streak: number;
  weakTopics: UserTopicProgress[];
  strongTopics: UserTopicProgress[];
  recentAttempts: UserAttempt[];
  dailyGoal: DailyGoal | null;
}

// ─── Session UI State ─────────────────────────────────────────────────────────

export interface SessionState {
  session: PracticeSession;
  questions: Question[];
  currentIndex: number;
  currentQuestion: Question | null;
  stepAnswers: Record<string, string>; // stepId -> answer
  submitted: boolean;
  lastAttempt: UserAttempt | null;
  isLoading: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  isEquivalent: boolean;
  error?: string;
}

export interface StepResult {
  stepId: string;
  stepOrder: number;
  isCorrect: boolean;
  userAnswer: string;
  expectedAnswer: string;
}

export interface AttemptResult {
  attemptId: string;
  isCorrect: boolean;
  isPartial: boolean;
  score: number;
  stepResults: StepResult[];
  explanation: string;
  errorType?: ErrorType;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface DailyAccuracy {
  date: string;
  accuracy: number;
  count: number;
}

export interface Statistics {
  overallAccuracy: number;
  totalSolved: number;
  totalDays: number;
  dailyAccuracy: DailyAccuracy[];
  topicProgress: UserTopicProgress[];
  bestTopic: UserTopicProgress | null;
  weakestTopic: UserTopicProgress | null;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
