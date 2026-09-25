import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { submitAttemptSchema } from "@/lib/validators";
import { validateNumber, validateExpression } from "@/services/sympy";
import { calculateMasteryScore, calculateNextDifficulty } from "@/lib/mastery";
import { ErrorType, StepResult } from "@/types";

export const dynamic = "force-dynamic";

function determineErrorType(stepResults: StepResult[], question: any): ErrorType {
  const failedSteps = stepResults.filter((s) => !s.isCorrect);
  if (failedSteps.length === 0) return "calculation_error";

  const firstFailed = failedSteps[0];
  if (firstFailed.stepOrder === 1) return "concept_error";
  if (question.answerType === "expression") return "algebra_error";
  return "calculation_error";
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const body = await request.json();
    const data = submitAttemptSchema.parse(body);

    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
      include: { steps: { include: { options: true }, orderBy: { order: "asc" } } },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const stepResults: StepResult[] = [];
    let correctSteps = 0;

    for (const answerItem of data.stepAnswers) {
      const step = question.steps.find((s) => s.id === answerItem.stepId);
      if (!step) continue;

      let isCorrect = false;
      const userAns = (answerItem.answer || "").trim();

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
      // Previous attempts count for this question in this session
      const prevCount = await tx.userAttempt.count({
        where: { userId, questionId: question.id, sessionId: data.sessionId },
      });

      const attempt = await tx.userAttempt.create({
        data: {
          userId,
          questionId: question.id,
          sessionId: data.sessionId,
          isCorrect,
          isPartial,
          score,
          timeSpent: data.timeSpent || 0,
          usedHint: data.usedHint || false,
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
        await tx.mistake.create({
          data: {
            userId,
            attemptId: attempt.id,
            questionId: question.id,
            topicId: question.topicId,
            subtopicId: question.subtopicId,
            errorType,
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
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { question: true },
      });

      const newScore = calculateMasteryScore(
        recentAttempts.map((a) => ({
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
        recentAttempts.map((a) => ({ isCorrect: a.isCorrect }))
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

      // Update PracticeSession
      if (data.sessionId) {
        await tx.practiceSession.update({
          where: { id: data.sessionId },
          data: {
            completedCount: { increment: 1 },
            correctCount: isCorrect ? { increment: 1 } : undefined,
          },
        });
      }

      // Update DailyGoal
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.dailyGoal.upsert({
        where: { userId_date: { userId, date: today } },
        update: { completedCount: { increment: 1 } },
        create: {
          userId,
          date: today,
          targetCount: 20,
          completedCount: 1,
        },
      });

      return {
        attemptId: attempt.id,
        isCorrect,
        isPartial,
        score,
        stepResults,
        explanation: question.explanation,
        errorType,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/attempts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
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
