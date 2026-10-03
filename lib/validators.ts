import { z } from "zod";
import { SessionMode } from "@/types";

// ─── Session ─────────────────────────────────────────────────────────────────

export const createSessionSchema = z.object({
  mode: z.enum(["mixed", "weak_topics", "specific_topic", "review_mistakes"]),
  totalCount: z.number().int().min(1).max(100),
  topicId: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ─── Attempt ──────────────────────────────────────────────────────────────────

export const stepAnswerSchema = z.object({
  stepId: z.string(),
  answer: z.string().trim().min(1, "Введите ответ").max(2000),
});

export const submitAttemptSchema = z.object({
  submissionId: z.string().uuid(),
  questionId: z.string(),
  sessionId: z.string(),
  stepAnswers: z.array(stepAnswerSchema).min(1).max(50).superRefine((answers, ctx) => {
    if (new Set(answers.map((answer) => answer.stepId)).size !== answers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Каждый шаг должен быть передан один раз" });
    }
  }),
  timeSpent: z.number().int().min(0).optional().default(0),
  usedHint: z.boolean().optional().default(false),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

// ─── Practice Setup ───────────────────────────────────────────────────────────

export const practiceSetupSchema = z.object({
  count: z
    .number()
    .int()
    .min(5, "Минимум 5 заданий")
    .max(100, "Максимум 100 заданий"),
  mode: z.enum(["mixed", "weak_topics", "specific_topic", "review_mistakes"]),
  topicId: z.string().optional(),
});

export type PracticeSetupInput = z.infer<typeof practiceSetupSchema>;

// ─── Daily Goal ───────────────────────────────────────────────────────────────

export const dailyGoalSchema = z.object({
  targetCount: z
    .number()
    .int()
    .min(1, "Минимум 1 задание")
    .max(200, "Максимум 200 заданий"),
});

export type DailyGoalInput = z.infer<typeof dailyGoalSchema>;

// ─── Validation ───────────────────────────────────────────────────────────────

export const validateExpressionSchema = z.object({
  userExpression: z.string(),
  expectedExpression: z.string(),
  variables: z.array(z.string()).optional().default([]),
});

export const validateNumberSchema = z.object({
  userAnswer: z.string(),
  expectedAnswer: z.string(),
  tolerance: z.number().optional().default(1e-9),
});

// ─── Filters ─────────────────────────────────────────────────────────────────

export const mistakesFilterSchema = z.object({
  topicId: z.string().optional(),
  errorType: z.string().optional(),
  isReviewed: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
});

// ─── AI Tutor ────────────────────────────────────────────────────────────────

export const aiTutorRequestSchema = z.object({
  action: z.enum([
    "hint",
    "explain",
    "explain_formula",
    "analyze_error",
    "check_steps",
    "where_mistake",
    "why_formula",
    "explain_topic",
    "similar_question",
    "chat",
  ]),
  language: z.enum(["ru", "kk", "en"]).default("ru"),
  topicId: z.string().optional(),
  questionId: z.string().optional(),
  attemptId: z.string().optional(),
  sessionId: z.string().optional(),
  userAnswer: z.string().optional(),
  stepAnswers: z.record(z.string()).optional(),
  hintLevel: z.number().int().min(1).max(3).optional(),
  userMessage: z.string().max(1000).optional(),
  formulaLatex: z.string().optional(),
  formulaName: z.string().optional(),
});

export type AiTutorRequestInput = z.infer<typeof aiTutorRequestSchema>;

export const aiErrorAnalysisSchema = z.object({
  errorType: z.string(),
  weakSkill: z.string(),
  reason: z.string(),
  shortExplanation: z.string(),
  hint: z.string(),
  recommendedAction: z
    .enum(["practice", "repeat_theory", "review_examples"])
    .default("practice"),
  recommendedDifficulty: z.number().min(1).max(5).default(2),
});

export const aiSimilarQuestionSchema = z.object({
  title: z.string(),
  questionText: z.string(),
  latex: z.string().optional(),
  hint: z.string().optional(),
  expectedAnswer: z.string(),
  explanation: z.string(),
});
