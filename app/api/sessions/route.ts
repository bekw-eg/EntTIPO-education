import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { createSessionSchema } from "@/lib/validators";
import { selectQuestionsForSession } from "@/lib/adaptive";
import { summarizeAttempts } from "@/lib/practiceStats";
import { ZodError } from "zod";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { makeChoiceSnapshots } from "@/lib/practiceChoice";
import { assertNoActiveExam } from "@/lib/exam/guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const body = await request.json();

    const validatedData = createSessionSchema.parse(body);

    const questionIds = await selectQuestionsForSession({
      userId,
      count: validatedData.totalCount,
      mode: validatedData.mode,
      topicId: validatedData.topicId,
      skillId: validatedData.skillId,
      questionId: validatedData.questionId,
    });

    if (!questionIds || questionIds.length === 0) {
      return localizedJson(request,
        { error: "Нет доступных заданий для этой тренировки" },
        { status: 400 }
      );
    }

    const session = await prisma.$transaction(async tx => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      return tx.practiceSession.create({
      data: {
        userId,
        topicId: validatedData.topicId,
        mode: validatedData.mode,
        startedAt: new Date(),
        status: "active",
        totalCount: questionIds.length,
        completedCount: 0,
        correctCount: 0,
        questionIds,
        choiceSnapshots: await makeChoiceSnapshots(tx, questionIds),
      },
      select: { id: true, mode: true, status: true, totalCount: true, questionIds: true, currentIndex: true, revision: true } });
    }, { maxWait: 10000, timeout: 10000 });

    return localizedJson(request, {
      id: session.id,
      session,
      questionIds,
    });
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return localizedJson(request, { error: "Invalid session settings" }, { status: 400 });
    }
    console.error("Error in POST /api/sessions:", error);
    return localizedJson(request,
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const sessions = await prisma.practiceSession.findMany({
      where: { userId, mode: { not: "offline_practice" }, ...(new URL(request.url).searchParams.get("status") === "active" ? { status: "active" } : {}) },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, userId: true, mode: true, topicId: true, status: true,
        totalCount: true, currentIndex: true, startedAt: true, completedAt: true,
        attempts: { select: { questionId: true, isCorrect: true } } },
    });

    return localizedJson(request, sessions.map(({ attempts, ...session }) => ({
      ...session, ...summarizeAttempts(attempts),
    })));
  } catch (error) {
    console.error("Error in GET /api/sessions:", error);
    return localizedJson(request,
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
