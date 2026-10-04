import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { summarizeAttempts } from "@/lib/practiceStats";
import { readPracticeSnapshot } from "@/lib/practiceSession";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { sessionId } = await context.params;

    const snapshot = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      return readPracticeSnapshot(tx, sessionId, userId);
    }, { maxWait: 10000, timeout: 10000 });
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
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
          completedCount: stats.completedCount, correctCount: stats.correctCount,
          draftAnswers: {}, revision: { increment: 1 } },
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
