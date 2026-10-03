import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { createSessionSchema } from "@/lib/validators";
import { selectQuestionsForSession } from "@/lib/adaptive";
import { summarizeAttempts } from "@/lib/practiceStats";

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
      },
    });

    return NextResponse.json({
      id: session.id,
      session,
      questionIds,
    });
  } catch (error) {
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
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { attempts: { select: { questionId: true, isCorrect: true } } },
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
