import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { submitAttemptSchema } from "@/lib/validators";
import { validateNumber, validateExpression } from "@/services/sympy";
import { calculateMasteryScore, calculateNextDifficulty } from "@/lib/mastery";
import { ErrorType, StepResult } from "@/types";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { summarizeAttempts } from "@/lib/practiceStats";

export const dynamic = "force-dynamic";

function replaySubmission(attempt: { submissionHash: string | null; submissionResult: Prisma.JsonValue | null }, hash: string) {
  if (attempt.submissionHash !== hash) throw new PracticeError("Submission ID has already been used for another answer", 409);
  if (!attempt.submissionResult) throw new PracticeError("Submission result is not available", 409);
  return attempt.submissionResult;
}

function determineErrorType(stepResults: StepResult[], question: any): ErrorType {
  const failedSteps = stepResults.filter((s) => !s.isCorrect);
  if (failedSteps.length === 0) return "calculation_error";

  const firstFailed = failedSteps[0];
  if (firstFailed.stepOrder === 1) return "concept_error";
  if (question.answerType === "expression") return "algebra_error";
  return "calculation_error";
}

function inferWeakSkill(question: any, errorType: string): string {
  if (question.subtopic?.name) {
    return question.subtopic.name;
  }
  const title = (question.title || "").toLowerCase();
  if (title.includes("степен") || title.includes("корн")) return "свойства_степеней";
  if (title.includes("многочлен") || title.includes("двучлен")) return "формулы_сокращенного_умножения";
  if (title.includes("комплексн")) return "комплексные_числа";
  if (title.includes("производн")) return "вычисление_производной";
  if (title.includes("касательн")) return "уравнение_касательной";
  if (title.includes("интеграл")) return "вычисление_интегралов";
  if (title.includes("первообразн")) return "первообразная_функция";
  if (title.includes("логарифм")) return "свойства_логарифмов";
  if (title.includes("тригонометр")) return "тригонометрические_функции";
  if (title.includes("дифференциальн") || title.includes("ду")) return "дифференциальные_уравнения";
  if (title.includes("стереометр") || title.includes("пирамид")) return "стереометрия_объемы";
  return errorType || "базовая_алгебра";
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const body = await request.json();
    const data = submitAttemptSchema.parse(body);
    const submissionHash = createHash("sha256").update(JSON.stringify({
      sessionId: data.sessionId,
      questionId: data.questionId,
      stepAnswers: [...data.stepAnswers].sort((a, b) => a.stepId.localeCompare(b.stepId)),
      timeSpent: data.timeSpent,
      usedHint: data.usedHint,
    })).digest("hex");
    const previousSubmission = await prisma.userAttempt.findUnique({
      where: { userId_submissionId: { userId, submissionId: data.submissionId } },
      select: { submissionHash: true, submissionResult: true },
    });
    if (previousSubmission) return NextResponse.json(replaySubmission(previousSubmission, submissionHash));

    const session = await prisma.practiceSession.findFirst({
      where: { id: data.sessionId, userId },
      select: { id: true, status: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
      include: {
        subtopic: true,
        steps: { include: { options: true }, orderBy: { order: "asc" } },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const answerMap = new Map(data.stepAnswers.map((answer) => [answer.stepId, answer.answer]));
    if (answerMap.size !== question.steps.length || question.steps.some((step) => !answerMap.has(step.id))) {
      throw new PracticeError("Provide exactly one answer for every step of this question", 400);
    }

    const stepResults: StepResult[] = [];
    let correctSteps = 0;

    for (const step of question.steps) {
      let isCorrect = false;
      const userAns = answerMap.get(step.id)!;

      if (step.type === "multiple_choice") {
        const correctOpt = step.options.find((o) => o.isCorrect);
        if (
          correctOpt &&
          (correctOpt.id === userAns ||
            correctOpt.text.trim().toLowerCase() === userAns.toLowerCase())
        ) {
          isCorrect = true;
        }
      } else if (step.type === "numeric_input") {
        const res = await validateNumber(userAns, step.expectedAnswer);
        isCorrect = res.isEquivalent;
      } else if (step.type === "expression_input") {
        const res = await validateExpression(userAns, step.expectedAnswer);
        isCorrect = res.isEquivalent;
      } else {
        isCorrect = userAns.toLowerCase() === step.expectedAnswer.trim().toLowerCase();
      }

      if (isCorrect) correctSteps++;

      stepResults.push({
        stepId: step.id,
        stepOrder: step.order,
        isCorrect,
        userAnswer: userAns,
        expectedAnswer: step.expectedAnswer,
      });
    }

    const totalSteps = question.steps.length;
    const isCorrect = totalSteps > 0 && correctSteps === totalSteps;
    const isPartial = correctSteps > 0 && correctSteps < totalSteps;
    const score = totalSteps > 0 ? Math.round((correctSteps / totalSteps) * 100) : 0;
    const errorType = isCorrect ? undefined : determineErrorType(stepResults, question);

    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      // A concurrent copy of this request may already have committed while grading ran.
      const duplicate = await tx.userAttempt.findUnique({
        where: { userId_submissionId: { userId, submissionId: data.submissionId } },
        select: { submissionHash: true, submissionResult: true },
      });
      if (duplicate) return replaySubmission(duplicate, submissionHash);
      const ownedSession = await tx.practiceSession.findFirst({ where: { id: data.sessionId, userId } });
      if (!ownedSession) throw new PracticeError("Session not found", 404);
      if (ownedSession.status !== "active") throw new PracticeError("Session is already completed", 409);
      if (ownedSession.topicId && ownedSession.topicId !== question.topicId) {
        throw new PracticeError("Question does not match the session topic", 400);
      }
      const sessionAttempts = await tx.userAttempt.findMany({
        where: { userId, sessionId: data.sessionId },
        select: { questionId: true, isCorrect: true },
      });
      const prevCount = sessionAttempts.filter((attempt) => attempt.questionId === question.id).length;
      if (prevCount === 0 && summarizeAttempts(sessionAttempts).completedCount >= ownedSession.totalCount) {
        throw new PracticeError("All questions in this session have already been answered", 409);
      }
      const usedHint = data.usedHint || ownedSession.hintedQuestionIds.includes(question.id);
      const latestAttempt = await tx.userAttempt.findFirst({
        where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
      });
      // Database NOW() uses transaction start time, which can precede the lock wait.
      // Give serialized attempts a stable chronological order, even within one millisecond.
      const createdAt = new Date(Math.max(Date.now(), (latestAttempt?.createdAt.getTime() ?? 0) + 1));

      const attempt = await tx.userAttempt.create({
        data: {
          userId,
          questionId: question.id,
          sessionId: data.sessionId,
          isCorrect,
          isPartial,
          score,
          timeSpent: data.timeSpent || 0,
          usedHint,
          submissionId: data.submissionId,
          submissionHash,
          createdAt,
          attemptNumber: prevCount + 1,
          stepAnswers: {
            create: stepResults.map((sr) => ({
              stepId: sr.stepId,
              answer: sr.userAnswer,
              isCorrect: sr.isCorrect,
            })),
          },
        },
      });

      if (!isCorrect && errorType) {
        const combinedUserAnswer = stepResults
          .map((sr) => sr.userAnswer)
          .filter(Boolean)
          .join("; ");

        const initialWeakSkill = inferWeakSkill(question, errorType);

        await tx.mistake.create({
          data: {
            userId,
            attemptId: attempt.id,
            questionId: question.id,
            topicId: question.topicId,
            subtopicId: question.subtopicId,
            errorType,
            weakSkill: initialWeakSkill,
            userAnswer: combinedUserAnswer || undefined,
            correctAnswer: question.correctAnswer || undefined,
            explanation: question.explanation,
            description: question.explanation,
          },
        });
      }

      // Update topic progress
      const currentProgress = (await tx.userTopicProgress.findUnique({
        where: { userId_topicId: { userId, topicId: question.topicId } },
      })) || { masteryScore: 0, currentLevel: 1, totalAttempts: 0, correctAttempts: 0 };

      const recentAttempts = await tx.userAttempt.findMany({
        where: { userId, question: { topicId: question.topicId } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        include: { question: true },
      });

      // Both algorithms expect oldest first; query the newest ten, then reverse them.
      const chronologicalAttempts = [...recentAttempts].reverse();
      const newScore = calculateMasteryScore(
        chronologicalAttempts.map((a) => ({
          isCorrect: a.isCorrect,
          isPartial: a.isPartial,
          score: a.score,
          usedHint: a.usedHint,
          difficulty: a.question.difficulty,
          attemptNumber: a.attemptNumber,
        })),
        currentProgress.masteryScore
      );

      const newLevel = calculateNextDifficulty(
        currentProgress.currentLevel,
        chronologicalAttempts.map((a) => ({ isCorrect: a.isCorrect }))
      );

      await tx.userTopicProgress.upsert({
        where: { userId_topicId: { userId, topicId: question.topicId } },
        update: {
          masteryScore: newScore,
          currentLevel: newLevel,
          totalAttempts: { increment: 1 },
          correctAttempts: isCorrect ? { increment: 1 } : undefined,
          lastAttemptAt: new Date(),
        },
        create: {
          userId,
          topicId: question.topicId,
          masteryScore: newScore,
          currentLevel: newLevel,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          lastAttemptAt: new Date(),
        },
      });

      const sessionStats = {
        ...summarizeAttempts([...sessionAttempts, { questionId: question.id, isCorrect }]),
        totalCount: ownedSession.totalCount,
        mode: ownedSession.mode,
      };
      await tx.practiceSession.update({
        where: { id: data.sessionId, userId },
        data: { completedCount: sessionStats.completedCount, correctCount: sessionStats.correctCount },
      });

      // Update DailyGoal
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todayQuestions = await tx.userAttempt.findMany({
        where: { userId, createdAt: { gte: today, lt: tomorrow } },
        select: { questionId: true },
        distinct: ["questionId"],
      });

      await tx.dailyGoal.upsert({
        where: { userId_date: { userId, date: today } },
        update: { completedCount: todayQuestions.length },
        create: {
          userId,
          date: today,
          targetCount: 20,
          completedCount: todayQuestions.length,
        },
      });

      const savedResult = {
        attemptId: attempt.id,
        isCorrect,
        isPartial,
        score,
        stepResults,
        explanation: question.explanation,
        errorType,
        usedHint,
        attemptNumber: attempt.attemptNumber,
        sessionStats,
      };
      // Persist the response in the same transaction so a lost response can be replayed exactly.
      const snapshot = JSON.parse(JSON.stringify(savedResult)) as Prisma.InputJsonValue;
      await tx.userAttempt.update({ where: { id: attempt.id, userId }, data: { submissionResult: snapshot } });
      return snapshot;
    }, { maxWait: 10000, timeout: 10000 });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid attempt payload" }, { status: 400 });
    }
    console.error("Error in POST /api/attempts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const attempts = await prisma.userAttempt.findMany({
      where: { userId, sessionId },
      include: {
        question: { include: { topic: true } },
        stepAnswers: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("Error in GET /api/attempts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
