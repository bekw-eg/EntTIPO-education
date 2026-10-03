import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { summarizeAttempts } from "@/lib/practiceStats";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { sessionId } = await context.params;

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId, userId },
      include: {
        attempts: {
          select: { id: true, questionId: true, isCorrect: true, createdAt: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let topic = null;
    if (session.topicId) {
      topic = await prisma.topic.findUnique({
        where: { id: session.topicId },
      });
    }

    return NextResponse.json({ ...session, ...summarizeAttempts(session.attempts), topic });
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { sessionId } = await context.params;

    const session = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      const owned = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
      if (!owned) throw new PracticeError("Session not found", 404);
      const attempts = await tx.userAttempt.findMany({
        where: { userId, sessionId }, select: { questionId: true, isCorrect: true },
      });
      const stats = summarizeAttempts(attempts);
      const saved = await tx.practiceSession.update({
        where: { id: sessionId, userId },
        data: { status: "completed", completedAt: owned.completedAt || new Date(),
          completedCount: stats.completedCount, correctCount: stats.correctCount },
      });
      return { ...saved, ...stats };
    }, { maxWait: 10000, timeout: 10000 });

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error in PATCH /api/sessions/[sessionId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
