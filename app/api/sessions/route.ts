import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { createSessionSchema } from "@/lib/validators";
import { selectQuestionsForSession } from "@/lib/adaptive";
import { summarizeAttempts } from "@/lib/practiceStats";
import { ZodError } from "zod";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
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
      return NextResponse.json(
        { error: "Нет доступных заданий для этой тренировки" },
        { status: 400 }
      );
    }

    const session = await prisma.practiceSession.create({
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
      },
    });

    return NextResponse.json({
      id: session.id,
      session,
      questionIds,
    });
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid session settings" }, { status: 400 });
    }
    console.error("Error in POST /api/sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const sessions = await prisma.practiceSession.findMany({
      where: { userId, ...(new URL(request.url).searchParams.get("status") === "active" ? { status: "active" } : {}) },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, userId: true, mode: true, topicId: true, status: true,
        totalCount: true, currentIndex: true, startedAt: true, completedAt: true,
        attempts: { select: { questionId: true, isCorrect: true } } },
    });

    return NextResponse.json(sessions.map(({ attempts, ...session }) => ({
      ...session, ...summarizeAttempts(attempts),
    })));
  } catch (error) {
    console.error("Error in GET /api/sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
