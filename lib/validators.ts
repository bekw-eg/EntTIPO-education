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
  answer: z.string().min(1, "Введите ответ"),
});

export const submitAttemptSchema = z.object({
  questionId: z.string(),
  sessionId: z.string(),
  stepAnswers: z.array(stepAnswerSchema),
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
